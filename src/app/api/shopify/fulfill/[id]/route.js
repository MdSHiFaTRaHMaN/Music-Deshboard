import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getSettings } from "@/lib/getSettings";
import { fulfillShopifyOrder } from "@/lib/shopifyFulfill";

// Helper to get payload
async function getAdminPayload(request) {
  const token = request.cookies.get("admin_token")?.value;
  if (!token) return null;
  const secret = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-fallback-key-change-me");
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (err) {
    return null;
  }
}

export async function POST(request, { params }) {
  try {
    // 1. Auth check
    const payload = await getAdminPayload(request);
    if (!payload || (payload.role !== "admin" && payload.role !== "staff")) {
      return NextResponse.json({ error: "Forbidden: Not authorized to fulfill orders" }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    // 2. Load Shopify Settings
    const settings = await getSettings();
    if (!settings.shopUrl1 || !settings.shopifyAdminApiKey) {
      return NextResponse.json({ error: "Shopify integration is not configured." }, { status: 500 });
    }

    // 3. Fulfill the order
    const fulfillResult = await fulfillShopifyOrder(id, settings);

    if (!fulfillResult.success) {
      return NextResponse.json({ error: fulfillResult.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: fulfillResult.message, fulfillment: fulfillResult.fulfillment });

  } catch (error) {
    console.error("[Manual Fulfill API] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
