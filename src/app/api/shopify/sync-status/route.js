import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Order from "@/models/Order";
import { getSettings } from "@/lib/getSettings";
import { jwtVerify } from "jose";
import { sendKlaviyoMusicDelivery } from "@/lib/klaviyo";
import { fulfillShopifyOrder } from "@/lib/shopifyFulfill";

export async function POST(request) {
  try {
    // Auth check using jose (same pattern as other routes)
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

    const settings = await getSettings();
    if (!settings.shopUrl1 || !settings.shopifyAdminApiKey) {
      return NextResponse.json({ error: "Shopify API not configured" }, { status: 500 });
    }

    let url = settings.shopUrl1;
    if (!url.startsWith("http")) url = `https://${url}`;

    await dbConnect();

    const shopifyRes = await fetch(`${url}/admin/api/2024-04/orders.json?status=any&limit=250`, {
      headers: {
        "X-Shopify-Access-Token": settings.shopifyAdminApiKey,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!shopifyRes.ok) {
      return NextResponse.json({ error: "Failed to fetch Shopify orders" }, { status: 500 });
    }

    const shopifyData = await shopifyRes.json();
    const shopifyOrders = shopifyData.orders || [];

    let updatedCount = 0;
    const updates = [];

    for (const shopifyOrder of shopifyOrders) {
      const financialStatus = shopifyOrder.financial_status || "pending";
      let musicIdFound = false;

      for (const item of shopifyOrder.line_items || []) {
        const musicIdProp = (item.properties || []).find(
          (p) => ["_musicid", "musicid", "music id"].includes(p.name?.toLowerCase())
        );
        if (musicIdProp && musicIdProp.value) {
          const result = await Order.findOneAndUpdate(
            { musicId: musicIdProp.value },
            { $set: { status: financialStatus, shopifyOrderId: shopifyOrder.id } },
            { returnDocument: 'after' }
          );
          if (result) {
            musicIdFound = true;
            updatedCount++;
            updates.push({ musicId: musicIdProp.value, status: financialStatus });
          }
        }
      }

      if (!musicIdFound && shopifyOrder.email) {
        const itemsToFulfill = shopifyOrder.line_items ? shopifyOrder.line_items.length : 1;
        const fallbackOrders = await Order.find({
          email: shopifyOrder.email,
          status: { $in: ["in_cart", "created", "pending_payment", "pending"] },
        }).sort({ createdAt: -1 }).limit(itemsToFulfill);

        for (const fOrder of fallbackOrders) {
          fOrder.status = financialStatus;
          fOrder.shopifyOrderId = shopifyOrder.id;
          await fOrder.save();
          updatedCount++;
        }
        if (fallbackOrders.length > 0) {
          updates.push({ email: shopifyOrder.email, status: financialStatus, count: fallbackOrders.length });
        }
      }

      // ── Bundled Klaviyo Automation & Auto Fulfill ──
      if (financialStatus === "paid") {
        const localOrders = await Order.find({ shopifyOrderId: shopifyOrder.id });
        if (localOrders.length > 0) {
          const allReady = localOrders.every(o => o.musicTracks && o.musicTracks.length > 0 && o.musicTracks[0].audioUrl);
          const anyUnsent = localOrders.some(o => !o.deliveryEmailSent);

          if (allReady && anyUnsent) {
            const klaviyoResult = await sendKlaviyoMusicDelivery(
              settings.klaviyoApiKey,
              shopifyOrder.email || localOrders[0].email,
              localOrders
            );

            if (klaviyoResult?.success) {
              await Promise.all(localOrders.map(o => 
                Order.updateOne({ _id: o._id }, { $set: { deliveryEmailSent: true } })
              ));
              await fulfillShopifyOrder(shopifyOrder.id, settings);
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${updatedCount} music orders from ${shopifyOrders.length} Shopify orders`,
      updates,
    });
  } catch (error) {
    console.error("[Sync Shopify Status] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
