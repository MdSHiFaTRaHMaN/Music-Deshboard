import dbConnect from "./mongoose";
import Order from "@/models/Order";
import { getSettings } from "./getSettings";

export async function getDashboardMetrics() {
  await dbConnect();

  try {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Basic total counts
    const totalOrders = await Order.countDocuments({});
    const distinctCustomers = await Order.distinct("email");
    const totalCustomers = distinctCustomers.length;

    // Growth counts
    const generatedOrdersThisMonth = await Order.countDocuments({ createdAt: { $gte: startOfThisMonth } });
    const generatedOrdersLastMonth = await Order.countDocuments({ createdAt: { $gte: startOfLastMonth, $lt: startOfThisMonth } });

    const customersThisMonthList = await Order.distinct("email", { createdAt: { $gte: startOfThisMonth } });
    const customersLastMonthList = await Order.distinct("email", { createdAt: { $gte: startOfLastMonth, $lt: startOfThisMonth } });
    const customersThisMonth = customersThisMonthList.length;
    const customersLastMonth = customersLastMonthList.length;

    // Shopify metrics
    const settings = await getSettings();
    let shopifyRecentOrders = [];
    let revenueThisMonth = 0;
    let revenueLastMonth = 0;
    let revenueToday = 0;
    let shopifyTotalOrders = 0;
    let shopifyOrdersThisMonth = 0;
    let shopifyOrdersLastMonth = 0;

    if (settings.shopUrl1 && settings.shopifyAdminApiKey) {
      try {
        let url = settings.shopUrl1;
        if (!url.startsWith('http')) url = `https://${url}`;
        
        // Fetch total count
        const countResponse = await fetch(`${url}/admin/api/2024-04/orders/count.json?status=any`, {
          headers: {
            "X-Shopify-Access-Token": settings.shopifyAdminApiKey,
            "Content-Type": "application/json"
          },
          cache: "no-store"
        });
        const countData = await countResponse.json();
        shopifyTotalOrders = countData.count || 0;

        const response = await fetch(`${url}/admin/api/2024-04/orders.json?status=any&limit=250&created_at_min=${startOfLastMonth.toISOString()}`, {
          headers: {
            "X-Shopify-Access-Token": settings.shopifyAdminApiKey,
            "Content-Type": "application/json"
          },
          cache: "no-store"
        });
        const data = await response.json();
        if (data.orders) {
          shopifyRecentOrders = data.orders.slice(0, 5); // Just first 5 for the table
          
          data.orders.forEach(order => {
            const orderDate = new Date(order.created_at);
            const price = parseFloat(order.total_price) || 0;
            
            if (orderDate >= startOfThisMonth) {
              revenueThisMonth += price;
              shopifyOrdersThisMonth += 1;
            } else if (orderDate >= startOfLastMonth && orderDate <= endOfLastMonth) {
              revenueLastMonth += price;
              shopifyOrdersLastMonth += 1;
            }
            
            if (orderDate >= startOfToday) {
              revenueToday += price;
            }
          });
        }
      } catch (err) {
        console.error("Error fetching recent Shopify orders:", err);
      }
    }

    let addedToCartTotal = Math.max(0, totalOrders - shopifyTotalOrders);
    let addedToCartThisMonth = Math.max(0, generatedOrdersThisMonth - shopifyOrdersThisMonth);
    let addedToCartLastMonth = Math.max(0, generatedOrdersLastMonth - shopifyOrdersLastMonth);

    // For MonthlySalesChart (Let's group by date for the last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const dailyOrdersAgg = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Build chart data array mapping each of the last 7 days to the count
    const chartCategories = [];
    const chartSeriesData = [];
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      
      const found = dailyOrdersAgg.find(item => item._id === dateStr);
      chartCategories.push(d.toLocaleDateString("en-US", { weekday: 'short' })); // e.g. Mon, Tue
      chartSeriesData.push(found ? found.count : 0);
    }

    return {
      totalOrders,
      totalCustomers,
      recentOrders: shopifyRecentOrders,
      chartData: {
        categories: chartCategories,
        series: chartSeriesData
      },
      revenueThisMonth,
      revenueLastMonth,
      revenueToday,
      customersThisMonth,
      customersLastMonth,
      generatedOrdersThisMonth,
      generatedOrdersLastMonth,
      shopifyTotalOrders,
      shopifyOrdersThisMonth,
      shopifyOrdersLastMonth,
      addedToCartTotal,
      addedToCartThisMonth,
      addedToCartLastMonth,
      monthlyTarget: settings.monthlyTarget
    };
  } catch (error) {
    console.error("Error fetching dashboard metrics:", error);
    return {
      totalOrders: 0,
      totalCustomers: 0,
      recentOrders: [],
      chartData: { categories: [], series: [] },
      revenueThisMonth: 0,
      revenueLastMonth: 0,
      revenueToday: 0,
      customersThisMonth: 0,
      customersLastMonth: 0,
      generatedOrdersThisMonth: 0,
      generatedOrdersLastMonth: 0,
      shopifyTotalOrders: 0,
      shopifyOrdersThisMonth: 0,
      shopifyOrdersLastMonth: 0,
      addedToCartTotal: 0,
      addedToCartThisMonth: 0,
      addedToCartLastMonth: 0,
      monthlyTarget: 20000
    };
  }
}
