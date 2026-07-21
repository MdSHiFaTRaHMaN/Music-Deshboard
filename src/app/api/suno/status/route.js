import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Order from "@/models/Order";
import Notification from "@/models/Notification";
import { getSettings } from "@/lib/getSettings";
import { withCORS, handleOptions } from "@/lib/cors";
import { decryptTaskId } from "@/lib/encryption";
import { generatePresignedUrl } from "@/lib/s3";

// Preflight — the browser sends this automatically before the real GET.
export async function OPTIONS(request) {
  return handleOptions(request);
}

// Poll endpoint for both lyrics and music task status
export async function GET(request) {
  const origin = request.headers.get("origin") || "";
  try {
    const { searchParams } = new URL(request.url);
    const encryptedTaskId = searchParams.get("taskId");
    const taskId = decryptTaskId(encryptedTaskId);
    const type = searchParams.get("type") || "music"; // "music" | "lyrics"

    if (!taskId) {
      return withCORS(NextResponse.json({ error: "taskId is required" }, { status: 400 }), origin);
    }

    // ── Use API key from DB (fallback to env) ──
    const settings = await getSettings();
    const apiKey = settings.sunoApiKey;
    if (!apiKey) {
      return withCORS(
        NextResponse.json({ error: "SUNO API Key not configured. Please set it in Settings." }, { status: 500 }),
        origin
      );
    }

    if (type === "music") {
      await dbConnect();
      const existingOrder = await Order.findOne({ taskId: taskId });
      
      if (!existingOrder) {
        return withCORS(NextResponse.json({ status: "PENDING", tracks: [], isFullySaved: false }), origin);
      }

      const currentTracks = existingOrder.musicTracks || [];
      const allTracksReady = currentTracks.length > 0 && currentTracks.every(t => t.audioUrl && t.streamAudioUrl);

      if (allTracksReady) {
        // Generate pre-signed URLs for the preview streaming
        const secureTracks = await Promise.all(currentTracks.map(async (track) => {
          let presignedUrl = track.streamAudioUrl;
          if (track.streamAudioUrl && track.streamAudioUrl.startsWith("music/")) {
            presignedUrl = await generatePresignedUrl(track.streamAudioUrl, 3600); // 1 hour expiry
          }
          return {
            id: track.id,
            title: track.title,
            streamAudioUrl: presignedUrl,
            imageUrl: track.imageUrl,
            duration: track.duration,
            lyrics: track.lyrics,
          };
        }));

        return withCORS(NextResponse.json({
          status: "SUCCESS",
          tracks: secureTracks,
          failed: false,
          isFullySaved: true
        }), origin);
      }

      // Still generating
      return withCORS(NextResponse.json({
        status: "PENDING",
        tracks: [],
        failed: false,
        isFullySaved: false
      }), origin);
    }

    // Lyrics: GET /api/v1/lyrics/record-info?taskId=...
    const endpoint = `${settings.sunoApiBase}/api/v1/lyrics/record-info?taskId=${taskId}`;

    const response = await fetch(endpoint, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    const data = await response.json();
    console.log(`[status/lyrics] Response:`, JSON.stringify(data).substring(0, 500));

    if (data.code !== 200) {
      return withCORS(
        NextResponse.json(
          { error: data.msg || "Failed to fetch status" },
          { status: 400 }
        ),
        origin
      );
    }

    const taskData = data.data;
    const status = taskData?.status;

    if (type === "lyrics") {
      const lyricsItems = taskData?.response?.data || [];
      return withCORS(
        NextResponse.json({
          status,
          // Return first successful lyrics variation
          lyrics: status === "SUCCESS" ? (lyricsItems[0]?.text || null) : null,
          title: status === "SUCCESS" ? (lyricsItems[0]?.title || null) : null,
          allVariations: status === "SUCCESS" ? lyricsItems : [],
        }),
        origin
      );
    }
  } catch (error) {
    console.error("[status] Error:", error);
    return withCORS(NextResponse.json({ error: "Internal server error" }, { status: 500 }), origin);
  }
}