import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Order from "@/models/Order";
import { getSettings } from "@/lib/getSettings";

export async function POST(request) {
  try {
    // ── Security: Origin / Referer check ──
    const settings = await getSettings();
    const originHeader = request.headers.get("origin") || "";
    const refererHeader = request.headers.get("referer") || "";
    const allowedOrigins = [
      settings.shopUrl,
      process.env.NEXT_PUBLIC_APP_URL,
      "http://localhost:3000",
      "http://localhost:3001",
    ].filter(Boolean);

    const isAllowed = allowedOrigins.some((allowed) => {
      try {
        const allowedUrl = new URL(allowed);
        const originUrl = originHeader ? new URL(originHeader) : null;
        const refererUrl = refererHeader ? new URL(refererHeader) : null;
        const hostMatch = (url) => url && url.host === allowedUrl.host;
        return hostMatch(originUrl) || hostMatch(refererUrl);
      } catch (e) {
        // Fallback to simple startsWith if parsing fails
        return originHeader.startsWith(allowed) || refererHeader.startsWith(allowed);
      }
    });

    if (!isAllowed) {
      return NextResponse.json(
        { error: "Unauthorized: Request origin not allowed" },
        { status: 403 }
      );
    }

    // ── Use API key from DB (fallback to env) ──
    const apiKey = settings.sunoApiKey;
    if (!apiKey) {
      return NextResponse.json({ error: "SUNO API Key not configured. Please set it in Settings." }, { status: 500 });
    }

    const { lyrics, style, title, formData } = await request.json();

    if (!lyrics) {
      return NextResponse.json({ error: "Lyrics are required" }, { status: 400 });
    }
    if (!formData || !formData.email) {
      return NextResponse.json({ error: "Email is required to save the generated order" }, { status: 400 });
    }

    // POST /api/v1/generate — required fields: customMode, instrumental, callBackUrl, model
    // In customMode=true + instrumental=false: style, title, and prompt (lyrics) are all required
    const callBackUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://example.com"}/api/suno/callback`;

    // Truncate to respect V4 limits: prompt max 3000 chars, style max 200 chars, title max 80 chars
    const safeStyle = (style || "Pop").substring(0, 200);
    const safeTitle = (title || "My Custom Song").substring(0, 80);
    const safeLyrics = lyrics.substring(0, 3000);

    const body = {
      prompt: safeLyrics,   // used as exact lyrics in custom mode
      style: safeStyle,
      title: safeTitle,
      customMode: true,     // use our exact lyrics
      instrumental: false,  // we want vocals
      model: "V4_5ALL",          // reliable model
      callBackUrl,          // required by API
    };

    console.log("[generate-music] Sending body:", JSON.stringify(body));

    const response = await fetch(`${settings.sunoApiBase}/api/v1/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    // Response shape: { code: 200, msg: "success", data: { taskId: "..." } }
    const data = await response.json();
    console.log("[generate-music] Response:", JSON.stringify(data));

    if (data.code !== 200) {
      return NextResponse.json(
        { error: data.msg || "Failed to start music generation" },
        { status: 400 }
      );
    }

    const taskId = data.data?.taskId;

    // Save pending order to Database
    if (taskId) {
      try {
        await dbConnect();
        await Order.create({
          taskId: taskId,
          email: formData.email,
          occasion: formData.occasion,
          forWho: formData.forWho,
          recipientName: formData.recipientName,
          genre: formData.genre,
          voice: formData.voice,
          mood: formData.mood,
          lyrics: formData.lyrics || lyrics,
          status: "pending_payment"
        });
      } catch (dbErr) {
        console.error("[generate-music] DB Error:", dbErr);
      }
    }

    return NextResponse.json({ taskId });
  } catch (error) {
    console.error("[generate-music] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
