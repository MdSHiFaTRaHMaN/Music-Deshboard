import { NextResponse } from "next/server";
import crypto from "crypto";
import dbConnect from "@/lib/mongoose";
import Notification from "@/models/Notification";
import Order from "@/models/Order";
import { getSettings } from "@/lib/getSettings";
import { sendKlaviyoMusicDelivery } from "@/lib/klaviyo";
import { fulfillShopifyOrder } from "@/lib/shopifyFulfill";

export async function POST(request) {
  try {
    const rawBody = await request.text();
    const hmacHeader = request.headers.get("X-Shopify-Hmac-Sha256");
    const shopDomain = request.headers.get("X-Shopify-Shop-Domain");

    const settings = await getSettings();
    // Allow using a dedicated Webhook Secret from .env, fallback to settings
    const shopifySecret = process.env.SHOPIFY_WEBHOOK_SECRET || settings.shopifySecretId;

    if (!shopifySecret) {
      console.error("[Shopify Webhook] Shopify Secret ID / Webhook Secret not configured");
      return NextResponse.json({ error: "Configuration missing" }, { status: 500 });
    }

    // Verify webhook signature
    const hash = crypto
      .createHmac("sha256", shopifySecret)
      .update(rawBody, "utf8", "hex")
      .digest("base64");

    if (hash !== hmacHeader) {
      console.error("[Shopify Webhook] HMAC validation failed.");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orderData = JSON.parse(rawBody);

    await dbConnect();

    // Check if the order has line items with a musicId property
    if (orderData.line_items && Array.isArray(orderData.line_items)) {
      const financialStatus = orderData.financial_status || "pending";
      // Map Shopify paid status to our system
      const newStatus = financialStatus; // "paid", "pending", "refunded" etc.

      let updated = false;

      for (const item of orderData.line_items) {
        if (item.properties && Array.isArray(item.properties)) {
          // Case-insensitive lookup — storefront may send "Music ID", "musicId", "_musicId" etc.
          const musicIdProp = item.properties.find(
            (p) => ["_musicid", "musicid", "music id"].includes(p.name?.toLowerCase())
          );
          if (musicIdProp && musicIdProp.value) {
            const result = await Order.findOneAndUpdate(
              { musicId: musicIdProp.value },
              { $set: { status: newStatus, shopifyOrderId: orderData.id } },
              { new: true }
            );
            if (result) {
              updated = true;
              console.log(`[Shopify Webhook] Updated music ${musicIdProp.value} → ${newStatus}`);
            }
          }
        }
      }

      // Fallback: if no musicId property found, try matching by customer email
      if (!updated && orderData.email) {
        // Only fetch as many fallback orders as there are line items in this Shopify order
        const itemsToFulfill = orderData.line_items ? orderData.line_items.length : 1;
        const fallbackOrders = await Order.find({
          email: orderData.email,
          status: { $in: ["in_cart", "created", "pending_payment", "pending"] },
        }).sort({ createdAt: -1 }).limit(itemsToFulfill);

        for (const fOrder of fallbackOrders) {
          fOrder.status = newStatus;
          fOrder.shopifyOrderId = orderData.id;
          await fOrder.save();
          console.log(`[Shopify Webhook] Fallback: updated ${fOrder._id} for ${orderData.email} → ${newStatus}`);
        }
      }

      // ── Bundled Klaviyo Automation & Auto Fulfill ──
      if (newStatus === "paid") {
        const localOrders = await Order.find({ shopifyOrderId: orderData.id });
        if (localOrders.length > 0) {
          const allReady = localOrders.every(o => o.musicTracks && o.musicTracks.length > 0 && o.musicTracks[0].audioUrl);
          const anyUnsent = localOrders.some(o => !o.deliveryEmailSent);

          if (allReady && anyUnsent) {
            const klaviyoResult = await sendKlaviyoMusicDelivery(
              settings.klaviyoApiKey,
              orderData.email || localOrders[0].email,
              localOrders,
              orderData.order_number
            );

            if (klaviyoResult?.success) {
              await Promise.all(localOrders.map(o =>
                Order.updateOne({ _id: o._id }, { $set: { deliveryEmailSent: true } })
              ));
              await fulfillShopifyOrder(orderData.id, settings);
            }
          }
        }
      }
    }
    
    // Create notification
    await Notification.create({
      title: "Shopify Order Update",
      message: `Order #${orderData.order_number} (${orderData.financial_status}) by ${orderData.email || 'a customer'} for $${orderData.total_price}`,
      type: "shopify_order",
      link: `/orders/${orderData.id}`
    });

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error("[Shopify Webhook] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
