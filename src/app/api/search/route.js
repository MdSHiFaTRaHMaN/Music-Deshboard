import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Order from "@/models/Order";
import { getSettings } from "@/lib/getSettings";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");

    if (!q || q.trim().length < 2) {
      return NextResponse.json({ results: [] });
    }

    await dbConnect();
    const queryStr = q.trim();
    const regex = new RegExp(queryStr, "i");

    // 1. Fetch Local Orders
    const localOrdersPromise = Order.find({
      $or: [
        { email: regex },
        { recipientName: regex },
        { musicId: regex },
        { taskId: regex },
        { genre: regex },
        { selectedPackage: regex },
        { occasion: regex },
        { shopifyOrderId: regex }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(8)
      .select("email recipientName status occasion forWho createdAt shopifyOrderId")
      .lean()
      .then(orders => orders.map(order => ({
        _id: order._id.toString(),
        type: "local",
        title: order.email || "No Email",
        subtitle: order.occasion || (order.forWho === "specific" ? `For: ${order.recipientName}` : "General"),
        status: order.status,
        url: `/all-musics/${order._id}`
      })));

    // 2. Fetch Shopify Orders
    const shopifyOrdersPromise = getSettings().then(async (settings) => {
      if (!settings.shopUrl1 || !settings.shopifyAdminApiKey) return [];
      
      let url = settings.shopUrl1;
      if (!url.startsWith('http')) url = `https://${url}`;
      
      let shopifyUrl = `${url}/admin/api/2024-04/orders.json?status=any`;
      const isEmail = queryStr.includes('@');
      const isNumber = !isNaN(queryStr.replace('#', ''));
      
      if (isEmail) {
        shopifyUrl += `&email=${encodeURIComponent(queryStr)}`;
      } else if (isNumber) {
        shopifyUrl += `&name=%23${queryStr.replace('#', '')}`;
      } else {
        shopifyUrl += `&limit=50`; // Fallback: fetch recent and filter in-memory
      }
      
      try {
        const res = await fetch(shopifyUrl, {
          headers: { "X-Shopify-Access-Token": settings.shopifyAdminApiKey },
          cache: "no-store"
        });
        if (!res.ok) return [];
        const data = await res.json();
        let orders = data.orders || [];
        
        if (!isEmail && !isNumber) {
          const lowerQ = queryStr.toLowerCase();
          orders = orders.filter(o => {
            const nameMatch = o.name && o.name.toLowerCase().includes(lowerQ);
            const emailMatch = o.email && o.email.toLowerCase().includes(lowerQ);
            const custMatch = o.customer && (`${o.customer.first_name} ${o.customer.last_name}`).toLowerCase().includes(lowerQ);
            return nameMatch || emailMatch || custMatch;
          });
        }
        
        return orders.slice(0, 5).map(order => ({
          _id: `shopify-${order.id}`,
          type: "shopify",
          title: `Order ${order.name}`,
          subtitle: order.customer ? `${order.customer.first_name} ${order.customer.last_name}` : order.email,
          status: order.financial_status || order.fulfillment_status || 'unknown',
          url: `/orders/${order.id}`
        }));
      } catch (err) {
        console.error("Shopify fetch error:", err);
        return [];
      }
    });

    const [localResults, shopifyResults] = await Promise.all([localOrdersPromise, shopifyOrdersPromise]);
    
    // Combine and return
    const combined = [...shopifyResults, ...localResults];
    return NextResponse.json({ results: combined });
    
  } catch (error) {
    console.error("Global search error:", error);
    return NextResponse.json({ error: "Internal server error", results: [] }, { status: 500 });
  }
}
