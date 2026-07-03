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
            { new: true }
          );
          if (result) {
            musicIdFound = true;
            updatedCount++;
            updates.push({ musicId: musicIdProp.value, status: financialStatus });

            // ── Klaviyo Automation & Auto Fulfill ──
            if (financialStatus === "paid" && !result.deliveryEmailSent) {
              const klaviyoResult = await sendKlaviyoMusicDelivery(
                settings.klaviyoApiKey,
                shopifyOrder.email || result.email,
                result
              );

              if (klaviyoResult?.success) {
                await Order.updateOne({ _id: result._id }, { $set: { deliveryEmailSent: true } });
                await fulfillShopifyOrder(shopifyOrder.id, settings);
              }
            }
          }
        }
      }

      if (!musicIdFound && shopifyOrder.email) {
        const fallbackOrders = await Order.find({
          email: shopifyOrder.email,
          status: { $in: ["in_cart", "created", "pending_payment", "pending"] },
        });

        for (const fOrder of fallbackOrders) {
          fOrder.status = financialStatus;
          fOrder.shopifyOrderId = shopifyOrder.id;
          await fOrder.save();
          updatedCount++;

          // ── Klaviyo Automation & Auto Fulfill ──
          if (financialStatus === "paid" && !fOrder.deliveryEmailSent) {
            const klaviyoResult = await sendKlaviyoMusicDelivery(
              settings.klaviyoApiKey,
              shopifyOrder.email,
              fOrder
            );

            if (klaviyoResult?.success) {
              await Order.updateOne({ _id: fOrder._id }, { $set: { deliveryEmailSent: true } });
              await fulfillShopifyOrder(shopifyOrder.id, settings);
            }
          }
        }
        if (fallbackOrders.length > 0) {
          updates.push({ email: shopifyOrder.email, status: financialStatus, count: fallbackOrders.length });
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
