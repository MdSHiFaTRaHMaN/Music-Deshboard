/**
 * Sends a custom event to Klaviyo to trigger the Music Delivery flow.
 * 
 * @param {string} klaviyoApiKey - The private API key for Klaviyo
 * @param {string} email - The customer's email address
 * @param {object} order - The full order object
 * @returns {boolean} - true if successful, false otherwise
 */
export async function sendKlaviyoMusicDelivery(klaviyoApiKey, email, order) {
  if (!klaviyoApiKey || !email) {
    console.error("[Klaviyo] Missing API key or email.");
    return false;
  }

  // Ensure we have generated tracks to send
  const tracks = order.musicTracks || [];
  if (tracks.length === 0 || !tracks[0].audioUrl) {
    console.error("[Klaviyo] Order has no generated audio URLs yet. Cannot send delivery email.");
    return false;
  }

  const payload = {
    data: {
      type: "event",
      attributes: {
        profile: {
          email: email,
        },
        metric: {
          name: "Music_Delivered",
        },
        properties: {
          musicId: order.musicId || "",
          shopifyOrderId: order.shopifyOrderId || "",
          primaryAudioUrl: tracks[0].audioUrl,
          allTracks: tracks.map((t) => ({
            title: t.title || "Custom Song",
            audioUrl: t.audioUrl,
            imageUrl: t.imageUrl || "",
          })),
          orderNotes: order.orderNotes || "",
          forWho: order.forWho || "",
          occasion: order.occasion || "",
          genre: order.genre || "",
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
      return false;
    }

    console.log(`[Klaviyo] Successfully sent Music_Delivered event to ${email}`);
    return true;
  } catch (error) {
    console.error("[Klaviyo] Network error sending event:", error);
    return false;
  }
}
