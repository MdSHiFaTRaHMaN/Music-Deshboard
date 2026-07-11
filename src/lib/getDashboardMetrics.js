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

    const addedToCartTotal = await Order.countDocuments({ status: "in_cart" });
    const addedToCartThisMonth = await Order.countDocuments({ status: "in_cart", createdAt: { $gte: startOfThisMonth } });
    const addedToCartLastMonth = await Order.countDocuments({ status: "in_cart", createdAt: { $gte: startOfLastMonth, $lt: startOfThisMonth } });

    // For MonthlySalesChart (aggregate up to 60 days)
    const nowForChart = new Date();
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(nowForChart.getDate() - 59);
    sixtyDaysAgo.setHours(0, 0, 0, 0);

    const dailyOrdersAgg = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: sixtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    const buildChartData = (days) => {
      const categories = [];
      const seriesData = [];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (days - 1));
      startDate.setHours(0, 0, 0, 0);
      
      for (let i = 0; i < days; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const found = dailyOrdersAgg.find(item => item._id === dateStr);
        
        let label = "";
        if (days === 7) {
          label = d.toLocaleDateString("en-US", { weekday: 'short' });
        } else {
          label = d.toLocaleDateString("en-US", { month: 'short', day: 'numeric' });
        }
        
        categories.push(label);
        seriesData.push(found ? found.count : 0);
      }
      return { categories, series: seriesData };
    };

    return {
      totalOrders,
      totalCustomers,
      recentOrders: shopifyRecentOrders,
      chartData: {
        '7_days': buildChartData(7),
        '30_days': buildChartData(30),
        '60_days': buildChartData(60),
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
