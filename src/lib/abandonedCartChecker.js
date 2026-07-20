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
      const sunoRes = await fetch(`${settings.sunoApiBase}/api/v1/generate/record-info?taskId=${taskId}`, {
        headers: {
          "Authorization": `Bearer ${settings.sunoApiKey}`
        }
      });
      const sunoData = await sunoRes.json();

      const taskData = sunoData.data;
      const status = taskData?.status;
      const tracksRaw = taskData?.response?.sunoData || [];

      if ((status === "SUCCESS" || status === "FIRST_SUCCESS") && tracksRaw.length > 0) {
        // Check if all tracks have their audioUrl populated
        const allReady = tracksRaw.every(t => t.audioUrl && t.duration);

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

          let updateObj = {};
          // Only update tracks if they haven't been updated yet (e.g. by frontend poll)
          if (!order.musicTracks || order.musicTracks.length === 0) {
            updateObj.musicTracks = tracks;
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
            if (Object.keys(updateObj).length > 0) {
               await Order.updateOne({ _id: order._id }, { $set: updateObj });
            }
            return;
          }

          // Always send the email immediately when ready, regardless of tab state.
          updateObj.resumeEmailSent = true;
          await Order.updateOne({ _id: order._id }, { $set: updateObj });
          
          // Trigger Klaviyo Event IMMEDIATELY when ready
          if (settings.klaviyoApiKey) {
            const resumeLink = `${resumeBaseUrl}?resumeOrder=${orderId}`;
            await sendKlaviyoMusicReady(settings.klaviyoApiKey, email, order, resumeLink);
            console.log(`[AbandonedCart] Klaviyo Music_Ready_To_Select event sent to ${email} (Immediately).`);
          }
        }
      } else if (status && ["CREATE_TASK_FAILED", "GENERATE_AUDIO_FAILED", "CALLBACK_EXCEPTION", "SENSITIVE_WORD_ERROR"].includes(status)) {
        console.log(`[AbandonedCart] Suno generation failed for ${taskId}. Status: ${status}`);
        clearInterval(intervalId);
      }

    } catch (err) {
      console.error("[AbandonedCart] Error:", err);
    }
  }, 10 * 1000); // 10 seconds
}
