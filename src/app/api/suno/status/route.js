import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Order from "@/models/Order";
import { getSettings } from "@/lib/getSettings";

// Poll endpoint for both lyrics and music task status
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId");
    const type = searchParams.get("type") || "music"; // "music" | "lyrics"

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    // ── Use API key from DB (fallback to env) ──
    const settings = await getSettings();
    const apiKey = settings.sunoApiKey;
    if (!apiKey) {
      return NextResponse.json({ error: "SUNO API Key not configured. Please set it in Settings." }, { status: 500 });
    }

    // Lyrics: GET /api/v1/lyrics/record-info?taskId=...
    // Music:  GET /api/v1/generate/record-info?taskId=...
    const endpoint = type === "lyrics"
      ? `${settings.sunoApiBase}/api/v1/lyrics/record-info?taskId=${taskId}`
      : `${settings.sunoApiBase}/api/v1/generate/record-info?taskId=${taskId}`;

    const response = await fetch(endpoint, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    const data = await response.json();
    console.log(`[status/${type}] Response:`, JSON.stringify(data).substring(0, 500));

    if (data.code !== 200) {
      return NextResponse.json(
        { error: data.msg || "Failed to fetch status" },
        { status: 400 }
      );
    }

    // data.data shape:
    // Lyrics:  { taskId, status, response: { taskId, data: [{ text, title, status }] } }
    // Music:   { taskId, status, response: { taskId, sunoData: [{ id, audioUrl, streamAudioUrl, imageUrl, title, duration }] } }
    const taskData = data.data;
    const status = taskData?.status; // "PENDING" | "SUCCESS" | "FIRST_SUCCESS" | failed statuses

    if (type === "lyrics") {
      const lyricsItems = taskData?.response?.data || [];
      return NextResponse.json({
        status,
        // Return first successful lyrics variation
        lyrics: status === "SUCCESS" ? (lyricsItems[0]?.text || null) : null,
        title: status === "SUCCESS" ? (lyricsItems[0]?.title || null) : null,
        allVariations: status === "SUCCESS" ? lyricsItems : [],
      });
    } else {
      // Music status SUCCESS or FIRST_SUCCESS means we have at least one track
      const sunoData = taskData?.response?.sunoData || [];
      const isDone = status === "SUCCESS" || status === "FIRST_SUCCESS";
      const hasFailed = ["CREATE_TASK_FAILED", "GENERATE_AUDIO_FAILED", "CALLBACK_EXCEPTION", "SENSITIVE_WORD_ERROR"].includes(status);

      // Check if all tracks have audioUrl and duration
      const allTracksReady = sunoData.length > 0 && sunoData.every(t => t.audioUrl && t.duration);

      // Save to database directly here to avoid exposing audioUrl to client
      if (isDone && taskId) {
        try {
          await dbConnect();
          const existingOrder = await Order.findOne({ taskId: taskId });
          if (existingOrder) {
            const currentTracks = existingOrder.musicTracks || [];
            const needsUpdate = currentTracks.length === 0 || currentTracks.some(t => !t.audioUrl || !t.duration);

            if (needsUpdate) {
              existingOrder.musicTracks = sunoData.map(track => ({
                id: track.id,
                title: track.title,
                audioUrl: track.audioUrl,
                streamAudioUrl: track.streamAudioUrl,
                imageUrl: track.imageUrl,
                duration: track.duration,
                lyrics: track.prompt,
              }));
              await existingOrder.save();
            }
          }
        } catch (dbErr) {
          console.error("[status] DB Save Error:", dbErr);
        }
      }

      return NextResponse.json({
        status,
        // Normalize the track objects to match our UI expectations, stripping audioUrl for client
        tracks: isDone ? sunoData.map(track => ({
          id: track.id,
          title: track.title,
          streamAudioUrl: track.streamAudioUrl, // Streaming URL (ready faster)
          imageUrl: track.imageUrl,
          duration: track.duration,
          lyrics: track.prompt,
        })) : [],
        failed: hasFailed,
        errorMessage: taskData?.errorMessage || null,
        isFullySaved: allTracksReady,
      });
    }
  } catch (error) {
    console.error("[status] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
