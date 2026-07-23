import { generatePresignedUrl } from "./s3.js";

/**
 * Sends a custom event to Klaviyo to trigger the Music Delivery flow.
 * 
 * @param {string} klaviyoApiKey - The private API key for Klaviyo
 * @param {string} email - The customer's email address
 * @param {Array|object} orders - An array of completed order objects (or a single object for backwards compatibility)
 * @param {string|number} orderNumber - The human readable order number (e.g. 1013)
 * @returns {object} - { success: boolean, error?: string }
 */
export async function sendKlaviyoMusicDelivery(klaviyoApiKey, email, orders, orderNumber = "") {
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

  const items = await Promise.all(validOrders.map(async order => {
    let selectedTrack = order.musicTracks[0];
    if (order.selectedDemo) {
      const matchedTrack = order.musicTracks.find(t => t.id === order.selectedDemo);
      if (matchedTrack) selectedTrack = matchedTrack;
    }

    let rawLyrics = selectedTrack.lyrics || order.lyrics || "";
    let rawAudioUrl = selectedTrack.audioUrl || order.musicTracks[0]?.audioUrl || "";
    let sourceAudioUrl = rawAudioUrl;

    // If rawAudioUrl is an S3 Key (e.g. "music/orderId/xyz.mp3"), generate a signed URL
    if (rawAudioUrl && !rawAudioUrl.startsWith("http://") && !rawAudioUrl.startsWith("https://")) {
      try {
        sourceAudioUrl = await generatePresignedUrl(rawAudioUrl, 7 * 24 * 3600); // 7 days expiration
      } catch (err) {
        console.error("[Klaviyo] Failed to generate presigned S3 URL:", err);
      }
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    const trackTitle = selectedTrack.title || order.musicTracks[0]?.title || "Custom Song";
    const safeFilename = `${trackTitle}.mp3`;

    // Direct download URL pointing to /api/download which sets Content-Disposition: attachment
    let directDownloadUrl = sourceAudioUrl;
    if (appUrl && sourceAudioUrl) {
      directDownloadUrl = `${appUrl}/api/download?url=${encodeURIComponent(sourceAudioUrl)}&filename=${encodeURIComponent(safeFilename)}`;
    }

    return {
      musicId: order.musicId || "",
      occasion: order.occasion || "",
      forWho: order.forWho || "",
      genre: order.genre || "",
      orderNotes: order.orderNotes || "",
      primaryAudioUrl: directDownloadUrl, // Direct MP3 download link for email template
      directDownloadUrl: directDownloadUrl,
      streamAudioUrl: sourceAudioUrl,
      title: trackTitle,
      imageUrl: selectedTrack.imageUrl || order.musicTracks[0]?.imageUrl || "",
      lyrics: rawLyrics,
    };
  }));

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
          shopifyOrderId: orderNumber ? `#${orderNumber}` : (baseOrder.shopifyOrderId || ""),
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

/**
 * Sends a custom event to Klaviyo when music is ready (Abandoned Cart Flow).
 * 
 * @param {string} klaviyoApiKey - The private API key for Klaviyo
 * @param {string} email - The customer's email address
 * @param {object} order - The order object
 * @param {string} resumeLink - The magic link to resume the cart
 * @returns {object} - { success: boolean, error?: string }
 */
export async function sendKlaviyoMusicReady(klaviyoApiKey, email, order, resumeLink) {
  if (!klaviyoApiKey || !email || !resumeLink) {
    console.error("[Klaviyo] Missing API key, email, or resumeLink.");
    return { success: false, error: "Missing required fields." };
  }

  const payload = {
    data: {
      type: "event",
      attributes: {
        profile: {
          data: {
            type: "profile",
            attributes: {
              email: email,
            }
          }
        },
        metric: {
          data: {
            type: "metric",
            attributes: {
              name: "Music_Ready_To_Select",
            }
          }
        },
        properties: {
          resumeLink: resumeLink,
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
        "revision": "2024-02-15",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Klaviyo] Failed to send Music_Ready_To_Select event:", response.status, errorText);
      return { success: false, error: errorText || `HTTP Error ${response.status}` };
    }

    console.log(`[Klaviyo] Successfully sent Music_Ready_To_Select event to ${email}`);
    return { success: true };
  } catch (error) {
    console.error("[Klaviyo] Network error sending event:", error);
    return { success: false, error: error.message || "Network error" };
  }
}

