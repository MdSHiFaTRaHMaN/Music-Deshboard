/**
 * Programmatically fulfills a Shopify order.
 * 
 * @param {string|number} orderId - The Shopify Order ID
 * @param {object} settings - The global settings object containing shopifyAdminApiKey and shopUrl1
 * @returns {object} - { success: boolean, message: string, fulfillment: object|null }
 */
export async function fulfillShopifyOrder(orderId, settings) {
  if (!settings || !settings.shopUrl1 || !settings.shopifyAdminApiKey) {
    console.error("[Shopify Fulfill] Shopify integration is not configured.");
    return { success: false, message: "Shopify API not configured" };
  }

  let url = settings.shopUrl1;
  if (!url.startsWith('http')) url = `https://${url}`;

  const headers = {
    "X-Shopify-Access-Token": settings.shopifyAdminApiKey,
    "Content-Type": "application/json"
  };

  try {
    // 1. Get fulfillment_orders for this order
    const fulfillmentOrdersRes = await fetch(`${url}/admin/api/2024-04/orders/${orderId}/fulfillment_orders.json`, {
      method: "GET",
      headers,
    });

    if (!fulfillmentOrdersRes.ok) {
      const errorText = await fulfillmentOrdersRes.text();
      console.error("[Shopify Fulfill] Failed to fetch fulfillment orders:", errorText);
      return { success: false, message: "Failed to retrieve fulfillment orders from Shopify" };
    }

    const fulfillmentOrdersData = await fulfillmentOrdersRes.json();
    const fulfillmentOrders = fulfillmentOrdersData.fulfillment_orders;

    if (!fulfillmentOrders || fulfillmentOrders.length === 0) {
      console.error("[Shopify Fulfill] No fulfillment orders found for this order.");
      console.error("[Shopify Fulfill] THIS USUALLY MEANS YOUR SHOPIFY APP IS MISSING PERMISSIONS!");
      console.error("[Shopify Fulfill] Please go to Shopify Admin > Settings > Apps > Custom Apps > Your App > API Credentials > Edit, and add 'write_merchant_managed_fulfillment_orders' and 'read_merchant_managed_fulfillment_orders' scopes.");
      return { success: false, message: "Missing 'merchant_managed_fulfillment_orders' API permission in Shopify App." };
    }

    // Find a fulfillable order
    const fulfillableOrder = fulfillmentOrders.find(fo => 
      fo.status.toUpperCase() === 'OPEN' || fo.status.toUpperCase() === 'IN_PROGRESS'
    );
    if (!fulfillableOrder) {
      console.warn("[Shopify Fulfill] No open fulfillment orders available. It might already be fulfilled.");
      return { success: false, message: "Already fulfilled or no open fulfillments" };
    }

    const fulfillmentOrderId = fulfillableOrder.id;
    const fulfillmentOrderLineItems = fulfillableOrder.line_items.map(item => ({
      id: item.id,
      quantity: item.quantity
    }));

    // 2. Create the Fulfillment
    const fulfillmentPayload = {
      fulfillment: {
        message: "Order fulfilled automatically via Music Dashboard integration.",
        notify_customer: false, // We already sent the email via Klaviyo
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
      console.error("[Shopify Fulfill] Failed to create fulfillment:", fulfillData);
      return { success: false, message: "Failed to fulfill order in Shopify", details: fulfillData };
    }

    console.log(`[Shopify Fulfill] Successfully fulfilled order ${orderId}`);
    return { success: true, message: "Order fulfilled successfully", fulfillment: fulfillData.fulfillment };

  } catch (error) {
    console.error("[Shopify Fulfill] Network error during fulfillment:", error);
    return { success: false, message: "Network error during fulfillment" };
  }
}
