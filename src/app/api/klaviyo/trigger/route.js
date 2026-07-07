import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Order from "@/models/Order";
import { getSettings } from "@/lib/getSettings";
import { sendKlaviyoMusicDelivery } from "@/lib/klaviyo";
import { fulfillShopifyOrder } from "@/lib/shopifyFulfill";
import { jwtVerify } from "jose";

export async function POST(request) {
  try {
    // Auth check using jose
    const token = request.cookies.get("admin_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    let payload;
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-fallback-key-change-me");
      const { payload: decoded } = await jwtVerify(token, secret);
      payload = decoded;
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    if (payload.role !== "admin" && payload.role !== "staff") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { shopifyOrderId, email, orderNumber } = body;

    if (!shopifyOrderId || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const settings = await getSettings();
    if (!settings.klaviyoApiKey) {
      return NextResponse.json({ error: "Klaviyo API Key not configured" }, { status: 500 });
    }

    await dbConnect();
    
    // Find all matching orders in MongoDB for this Shopify Order
    const localOrders = await Order.find({ shopifyOrderId });
    
    if (!localOrders || localOrders.length === 0) {
      // Also try to find by email if shopifyOrderId is not perfectly synced yet
      const fallbackOrder = await Order.findOne({ email }).sort({ createdAt: -1 });
      if (!fallbackOrder) {
        return NextResponse.json({ error: "No matching music order found in database" }, { status: 404 });
      }
      
      const klaviyoResult = await sendKlaviyoMusicDelivery(settings.klaviyoApiKey, email, [fallbackOrder], orderNumber);
      if (!klaviyoResult?.success) return NextResponse.json({ error: `Klaviyo Error: ${klaviyoResult?.error || 'Unknown error'}` }, { status: 500 });
      
      await Order.updateOne({ _id: fallbackOrder._id }, { $set: { deliveryEmailSent: true } });
      await fulfillShopifyOrder(shopifyOrderId, settings);
      return NextResponse.json({ success: true, message: "Successfully triggered Klaviyo event (using email match)" });
    }

    // Check if ALL songs in this order are finished
    const allReady = localOrders.every(o => o.musicTracks && o.musicTracks.length > 0 && o.musicTracks[0].audioUrl);
    if (!allReady) {
      return NextResponse.json({ error: "Cannot send yet: Not all songs in this order have finished generating." }, { status: 400 });
    }

    const klaviyoResult = await sendKlaviyoMusicDelivery(settings.klaviyoApiKey, email, localOrders, orderNumber);
    
    if (klaviyoResult?.success) {
      // Mark all as sent
      await Promise.all(localOrders.map(o => 
        Order.updateOne({ _id: o._id }, { $set: { deliveryEmailSent: true } })
      ));
      
      // Also fulfill in Shopify
      const fulfillResult = await fulfillShopifyOrder(shopifyOrderId, settings);
      if (!fulfillResult.success) {
        return NextResponse.json({ success: true, message: `Email sent successfully, BUT fulfillment failed: ${fulfillResult.message}` });
      }
      
      return NextResponse.json({ success: true, message: "Successfully sent Klaviyo event for all songs and fulfilled order!" });
    } else {
      return NextResponse.json({ error: `Klaviyo Error: ${klaviyoResult?.error || 'Unknown error'}` }, { status: 500 });
    }

  } catch (error) {
    console.error("[Klaviyo Trigger API Error]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
