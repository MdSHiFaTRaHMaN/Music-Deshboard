/**
 * Sends a custom event to Klaviyo to trigger the Music Delivery flow.
 * 
 * @param {string} klaviyoApiKey - The private API key for Klaviyo
 * @param {string} email - The customer's email address
 * @param {Array|object} orders - An array of completed order objects (or a single object for backwards compatibility)
 * @returns {object} - { success: boolean, error?: string }
 */
export async function sendKlaviyoMusicDelivery(klaviyoApiKey, email, orders) {
  if (!klaviyoApiKey || !email) {
    console.error("[Klaviyo] Missing API key or email.");
    return { success: false, error: "Missing API key or email in request." };
  }

  // Normalize to array
  const orderList = Array.isArray(orders) ? orders : [orders];
  if (orderList.length === 0) {
    return { success: false, error: "No orders provided." };
  }

  // Filter for valid orders with tracks
  const validOrders = orderList.filter(o => o.musicTracks && o.musicTracks.length > 0 && o.musicTracks[0].audioUrl);
  if (validOrders.length === 0) {
    console.error("[Klaviyo] No complete music tracks to send.");
    return { success: false, error: "No completed music tracks found for these orders." };
  }

  // The first valid order acts as the base for order-level properties
  const baseOrder = validOrders[0];

  const items = validOrders.map(order => {
    let selectedTrack = order.musicTracks[0];
    if (order.selectedDemo) {
      const matchedTrack = order.musicTracks.find(t => t.id === order.selectedDemo);
      if (matchedTrack) selectedTrack = matchedTrack;
    }

    return {
      musicId: order.musicId || "",
      occasion: order.occasion || "",
      forWho: order.forWho || "",
      genre: order.genre || "",
      orderNotes: order.orderNotes || "",
      primaryAudioUrl: selectedTrack.audioUrl || "",
      title: selectedTrack.title || order.musicTracks[0]?.title || "Custom Song",
      imageUrl: selectedTrack.imageUrl || order.musicTracks[0]?.imageUrl || "",
    };
  });

  console.log(`[Klaviyo] Preparing to send email to ${email}. Number of items: ${items.length}`);

  const payload = {
    data: {
      type: "event",
      attributes: {
        profile: {
          data: {
            type: "profile",
            attributes: {
              first_name: baseOrder?.name?.split(" ")[0] || "",
              last_name: baseOrder?.name?.split(" ")[1] || "",
              email: email,
            }
          }
        },
        metric: {
          data: {
            type: "metric",
            attributes: {
              name: "Music_Delivered",
            }
          }
        },
        properties: {
          shopifyOrderId: baseOrder.shopifyOrderId || "",
          items: items,
        },
        time: new Date().toISOString(),
      },
    },
  };

  try {
    const response = await fetch("https://a.klaviyo.com/api/events/", {
      method: "POST",
      headers: {
        "Authorization": `Klaviyo-API-Key ${klaviyoApiKey}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
        "revision": "2024-02-15", // Required by Klaviyo v3 API
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Klaviyo] Failed to send event:", response.status, errorText);
      return { success: false, error: errorText || `HTTP Error ${response.status}` };
    }

    console.log(`[Klaviyo] Successfully sent Music_Delivered event to ${email}`);
    return { success: true };
  } catch (error) {
    console.error("[Klaviyo] Network error sending event:", error);
    return { success: false, error: error.message || "Network error" };
  }
}
