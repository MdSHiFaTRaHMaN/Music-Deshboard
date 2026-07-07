import dbConnect from "@/lib/mongoose";
import Order from "@/models/Order";
import { sendKlaviyoMusicReady } from "@/lib/klaviyo";
import { getSettings } from "@/lib/getSettings";

export function checkAbandonedCart(orderId, taskId, email, resumeBaseUrl) {
  const maxAttempts = 60; // 60 attempts * 10 seconds = 10 minutes total timeout
  let attempts = 0;

  // Poll every 10 seconds
  const intervalId = setInterval(async () => {
    attempts++;
    if (attempts > maxAttempts) {
      console.log(`[AbandonedCart] Order ${orderId} timed out after 10 minutes.`);
      clearInterval(intervalId);
      return;
    }

    try {
      await dbConnect();
      const order = await Order.findById(orderId);
      
      // If order doesn't exist, stop checking
      if (!order) {
        clearInterval(intervalId);
        return;
      }

      // If email was already sent or user proceeded to checkout, stop checking
      if (order.resumeEmailSent || order.status !== "created") {
        clearInterval(intervalId);
        return;
      }
      
      const settings = await getSettings();
      if (!settings.sunoApiBase) {
        console.log("[AbandonedCart] sunoApiBase not set.");
        clearInterval(intervalId);
        return;
      }

      // Check Suno status
      const sunoRes = await fetch(`${settings.sunoApiBase}/api/v1/generate/record-info?taskId=${taskId}`);
      const sunoData = await sunoRes.json();

      if ((sunoData.status === "SUCCESS" || sunoData.status === "FIRST_SUCCESS") && sunoData.data && sunoData.data.data) {
        const tracksRaw = sunoData.data.data;
        // Check if all tracks have their audioUrl populated
        const allReady = tracksRaw.length > 0 && tracksRaw.every(t => t.audioUrl && t.duration);

        if (allReady) {
          clearInterval(intervalId); // Stop checking

          const tracks = tracksRaw.map((track) => ({
            id: track.id,
            title: track.title,
            imageUrl: track.imageUrl,
            audioUrl: track.audioUrl,
            streamAudioUrl: track.streamAudioUrl || track.audioUrl,
            duration: track.duration,
            status: track.status,
          }));

          // Only update tracks if they haven't been updated yet (e.g. by frontend poll)
          if (!order.musicTracks || order.musicTracks.length === 0) {
            order.musicTracks = tracks;
          }
          
          console.log(`[AbandonedCart] Order ${orderId} completed generation. Tracks saved to DB.`);

          // CRITICAL CHECK: Did the user hit "Regenerate"?
          // If they created a newer order, we should completely ignore this older one
          // to prevent sending them emails for abandoned/old versions of their songs.
          const newerOrder = await Order.findOne({
            email: email,
            createdAt: { $gt: order.createdAt }
          });

          if (newerOrder) {
            console.log(`[AbandonedCart] User regenerated (newer order ${newerOrder._id} exists). Aborting email for ${orderId}.`);
            await order.save();
            return;
          }

          // Only send the email if the user is NO LONGER on the page (tab is closed).
          // We know the tab is closed if the frontend hasn't polled status in the last 15 seconds.
          const isTabClosed = !order.lastPolledAt || (Date.now() - new Date(order.lastPolledAt).getTime() > 15000);

          if (isTabClosed) {
            order.resumeEmailSent = true;
            await order.save();
            
            // Trigger Klaviyo Event IMMEDIATELY when ready
            if (settings.klaviyoApiKey) {
              const resumeLink = `${resumeBaseUrl}?resumeOrder=${orderId}`;
              await sendKlaviyoMusicReady(settings.klaviyoApiKey, email, order, resumeLink);
              console.log(`[AbandonedCart] Klaviyo Music_Ready_To_Select event sent to ${email} (Tab was closed).`);
            }
          } else {
            // Save tracks but don't mark email as sent yet
            await order.save();
            console.log(`[AbandonedCart] Tab is still open. Waiting 30 minutes to see if they checkout...`);
            
            // Spawn a new timeout for 30 minutes to send an abandoned cart email if they don't checkout
            setTimeout(async () => {
              try {
                await dbConnect();
                const checkOrder = await Order.findById(orderId);
                // If it's still 'created' after 30 mins, they didn't checkout.
                if (checkOrder && checkOrder.status === "created" && !checkOrder.resumeEmailSent) {
                  // Double check they didn't regenerate while we were waiting
                  const newerOrderLater = await Order.findOne({
                    email: email,
                    createdAt: { $gt: checkOrder.createdAt }
                  });

                  if (newerOrderLater) {
                    console.log(`[AbandonedCart] User regenerated during 30m wait. Aborting delayed email for ${orderId}.`);
                    return;
                  }

                  const settingsLater = await getSettings();
                  if (settingsLater.klaviyoApiKey) {
                    const resumeLink = `${resumeBaseUrl}?resumeOrder=${orderId}`;
                    await sendKlaviyoMusicReady(settingsLater.klaviyoApiKey, email, checkOrder, resumeLink);
                    
                    checkOrder.resumeEmailSent = true;
                    await checkOrder.save();
                    console.log(`[AbandonedCart] Klaviyo event sent to ${email} (Abandoned after 30 mins).`);
                  }
                }
              } catch (e) {
                console.error("[AbandonedCart] Delayed check error:", e);
              }
            }, 30 * 60 * 1000); // 30 mins
          }
        }
      } else if (["CREATE_TASK_FAILED", "GENERATE_AUDIO_FAILED", "CALLBACK_EXCEPTION", "SENSITIVE_WORD_ERROR"].includes(sunoData.status)) {
        console.log(`[AbandonedCart] Suno generation failed for ${taskId}. Status: ${sunoData.status}`);
        clearInterval(intervalId);
      }

    } catch (err) {
      console.error("[AbandonedCart] Error:", err);
    }
  }, 10 * 1000); // 10 seconds
}
