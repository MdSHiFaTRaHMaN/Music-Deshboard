import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getSettings } from "@/lib/getSettings";

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
    if (!payload || payload.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Only admins can fulfill orders" }, { status: 403 });
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

    let url = settings.shopUrl1;
    if (!url.startsWith('http')) url = `https://${url}`;

    const headers = {
      "X-Shopify-Access-Token": settings.shopifyAdminApiKey,
      "Content-Type": "application/json"
    };

    // 3. Get fulfillment_orders for this order
    const fulfillmentOrdersRes = await fetch(`${url}/admin/api/2024-04/orders/${id}/fulfillment_orders.json`, {
      method: "GET",
      headers,
    });

    if (!fulfillmentOrdersRes.ok) {
      const errorText = await fulfillmentOrdersRes.text();
      console.error("Failed to fetch fulfillment orders:", errorText);
      return NextResponse.json({ error: "Failed to retrieve fulfillment orders from Shopify" }, { status: fulfillmentOrdersRes.status });
    }

    const fulfillmentOrdersData = await fulfillmentOrdersRes.json();
    console.log("Fulfillment Orders Response from Shopify:", JSON.stringify(fulfillmentOrdersData, null, 2));
    const fulfillmentOrders = fulfillmentOrdersData.fulfillment_orders;

    if (!fulfillmentOrders || fulfillmentOrders.length === 0) {
      return NextResponse.json({ 
        error: "No fulfillment orders found. If this is a digital product, Shopify requires 'Requires shipping' to be enabled on the product to fulfill it via API.", 
        debug_shopify_response: fulfillmentOrdersData 
      }, { status: 404 });
    }

    // Find a fulfillable order
    const fulfillableOrder = fulfillmentOrders.find(fo => fo.status === 'OPEN' || fo.status === 'IN_PROGRESS');
    if (!fulfillableOrder) {
      return NextResponse.json({ error: "No open fulfillment orders available to fulfill. It might already be fulfilled." }, { status: 400 });
    }

    const fulfillmentOrderId = fulfillableOrder.id;
    const fulfillmentOrderLineItems = fulfillableOrder.line_items.map(item => ({
      id: item.id,
      quantity: item.quantity
    }));

    // 4. Create the Fulfillment
    const fulfillmentPayload = {
      fulfillment: {
        message: "Order fulfilled via Dashboard.",
        notify_customer: true,
        line_items_by_fulfillment_order: [
          {
            fulfillment_order_id: fulfillmentOrderId,
            fulfillment_order_line_items: fulfillmentOrderLineItems
          }
        ]
      }
    };

    const fulfillRes = await fetch(`${url}/admin/api/2024-04/fulfillments.json`, {
      method: "POST",
      headers,
      body: JSON.stringify(fulfillmentPayload)
    });

    const fulfillData = await fulfillRes.json();

    if (!fulfillRes.ok) {
      console.error("Failed to create fulfillment:", fulfillData);
      return NextResponse.json({ error: "Failed to fulfill order", details: fulfillData.errors || fulfillData }, { status: fulfillRes.status });
    }

    return NextResponse.json({ message: "Order fulfilled successfully", fulfillment: fulfillData.fulfillment }, { status: 200 });
  } catch (error) {
    console.error("Error in fulfill API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
