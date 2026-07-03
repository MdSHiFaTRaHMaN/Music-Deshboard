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
    return { success: false, error: "Missing API key or email in request." };
  }

  // Ensure we have generated tracks to send
  const tracks = order.musicTracks || [];
  if (tracks.length === 0 || !tracks[0].audioUrl) {
    console.error("[Klaviyo] No complete music tracks to send.");
    return { success: false, error: "No completed music tracks found for this order." };
  }

  // Find the track the user selected, or fallback to the first track
  let selectedTrack = tracks[0];
  if (order.selectedDemo) {
    const matchedTrack = tracks.find(t => t.id === order.selectedDemo);
    if (matchedTrack) {
      selectedTrack = matchedTrack;
    }
  }

  const payload = {
    data: {
      type: "event",
      attributes: {
        profile: {
          data: {
            type: "profile",
            attributes: {
              first_name: order?.name?.split(" ")[0] || "",
              last_name: order?.name?.split(" ")[1] || "",
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
          musicId: order.musicId || "",
          shopifyOrderId: order.shopifyOrderId || "",
          primaryAudioUrl: selectedTrack.audioUrl,
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
      return { success: false, error: errorText || `HTTP Error ${response.status}` };
    }

    console.log(`[Klaviyo] Successfully sent Music_Delivered event to ${email}`);
    return { success: true };
  } catch (error) {
    console.error("[Klaviyo] Network error sending event:", error);
    return { success: false, error: error.message || "Network error" };
  }
}
