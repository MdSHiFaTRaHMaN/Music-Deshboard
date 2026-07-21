import { Worker } from "bullmq";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { pipeline } from "stream/promises";
import ffmpeg from "fluent-ffmpeg";
import dbConnect from "../lib/mongoose.js";
import Order from "../models/Order.js";
import Notification from "../models/Notification.js";
import { uploadToS3 } from "../lib/s3.js";
import redis from "../lib/redis.js";
import { getSettings } from "../lib/getSettings.js";
import { sendKlaviyoMusicDelivery } from "../lib/klaviyo.js";
import { fulfillShopifyOrder } from "../lib/shopifyFulfill.js";

const TEMP_DIR = os.tmpdir();

async function downloadFile(url, destPath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: ${response.statusText}`);
  const destStream = fs.createWriteStream(destPath);
  await pipeline(response.body, destStream);
}

function createPreview(inputPath, outputPath, durationSeconds) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime("00:00:15") // Start preview at 15s
      .setDuration(durationSeconds.toString()) // Dynamic duration
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

// Polling helper
async function pollSuno(taskId, apiKey, apiBase) {
  const maxAttempts = 120; // up to 10 mins (120 * 5s)
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${apiBase}/api/v1/generate/record-info?taskId=${taskId}`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });
    const data = await res.json();
    const status = data.data?.status;
    
    if (status === "SUCCESS") {
      return data.data;
    } else if (["CREATE_TASK_FAILED", "GENERATE_AUDIO_FAILED", "CALLBACK_EXCEPTION"].includes(status)) {
      throw new Error(`Suno API failed with status: ${status}`);
    }
    
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error("Suno API polling timed out");
}

export const worker = new Worker("music-generation", async (job) => {
  const { taskId, orderId, sunoBody, apiKey, apiBase } = job.data;
  console.log(`[Worker] Processing job for taskId: ${taskId}, orderId: ${orderId}`);

  await dbConnect();
  const settings = await getSettings();
  const previewDuration = settings?.previewDurationSeconds || 45;

  try {
    // 1. Hit Suno to start generation
    const response = await fetch(`${apiBase}/api/v1/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(sunoBody),
    });
    const sunoRes = await response.json();
    
    if (sunoRes.code !== 200) {
      throw new Error(sunoRes.msg || "Failed to start music generation");
    }
    
    const realTaskId = sunoRes.data?.taskId;
    
    // 2. Poll until success
    const resultData = await pollSuno(realTaskId, apiKey, apiBase);
    const sunoTracks = resultData.response?.sunoData || [];
    
    if (sunoTracks.length === 0) {
      throw new Error("No tracks returned from Suno");
    }

    const processedTracks = [];

    // 3. Process each track
    for (const track of sunoTracks) {
      if (!track.audioUrl) continue;
      
      const fullPath = path.join(TEMP_DIR, `${track.id}_full.mp3`);
      const previewPath = path.join(TEMP_DIR, `${track.id}_preview.mp3`);
      
      console.log(`[Worker] Downloading track ${track.id}...`);
      await downloadFile(track.audioUrl, fullPath);
      
      console.log(`[Worker] Creating preview for track ${track.id}...`);
      await createPreview(fullPath, previewPath, previewDuration);
      
      console.log(`[Worker] Uploading to S3 for track ${track.id}...`);
      const s3FullKey = `music/${orderId}/${crypto.randomUUID()}.mp3`;
      const s3PreviewKey = `music/${orderId}/${crypto.randomUUID()}.mp3`;
      
      await uploadToS3(fullPath, s3FullKey, "audio/mpeg");
      await uploadToS3(previewPath, s3PreviewKey, "audio/mpeg");
      
      processedTracks.push({
        id: track.id,
        title: track.title,
        audioUrl: s3FullKey, // Backend full file key
        streamAudioUrl: s3PreviewKey, // Preview stream key
        imageUrl: track.imageUrl,
        duration: track.duration,
        lyrics: track.prompt,
      });

      // Cleanup temp files
      fs.unlinkSync(fullPath);
      fs.unlinkSync(previewPath);
    }

    // 4. Update Database
    const order = await Order.findById(orderId);
    if (order) {
      order.musicTracks = processedTracks;
      order.lastPolledAt = new Date();
      await order.save();
      
      await Notification.create({
        title: "Music Generation Complete",
        message: `The song for ${order.email} is ready!`,
        type: "music_generated",
        link: `/ordered-musics/${order._id}`,
      });
      console.log(`[Worker] Order ${orderId} successfully completed and saved.`);
      
      // If the order is already marked as paid, trigger Klaviyo now
      if (order.status === "paid" && !order.deliveryEmailSent) {
        console.log(`[Worker] Order is paid. Triggering Klaviyo and Shopify fulfillment...`);
        try {
          const settings = await getSettings();
          if (settings.klaviyoApiKey) {
            const klaviyoResult = await sendKlaviyoMusicDelivery(settings.klaviyoApiKey, order.email, [order], order.orderNumber);
            if (klaviyoResult.success) {
              order.deliveryEmailSent = true;
              await order.save();
              console.log(`[Worker] Successfully sent Klaviyo email for ${order.email}`);
              
              if (order.shopifyOrderId) {
                await fulfillShopifyOrder(order.shopifyOrderId, settings);
              }
            } else {
              console.error(`[Worker] Failed to send Klaviyo email: ${klaviyoResult.error}`);
            }
          } else {
            console.warn(`[Worker] Klaviyo API key not found in settings.`);
          }
        } catch(e) {
          console.error(`[Worker] Error triggering Klaviyo:`, e);
        }
      }
    }

  } catch (err) {
    console.error(`[Worker] Job failed for order ${orderId}:`, err);
    throw err; // Let BullMQ handle retries
  }
}, { 
  connection: redis,
  concurrency: 5 // Process 5 generations concurrently max
});

worker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} completed successfully`);
});

worker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job.id} failed with error:`, err);
});
