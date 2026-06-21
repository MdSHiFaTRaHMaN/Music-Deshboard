import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Order from "@/models/Order";

const sunoApiBase = process.env.SUNO_API_BASE;

export async function POST(request) {
  try {
    const { lyrics, style, title, formData } = await request.json();

    if (!lyrics) {
      return NextResponse.json({ error: "Lyrics are required" }, { status: 400 });
    }
    if (!formData || !formData.email) {
      return NextResponse.json({ error: "Email is required to save the generated order" }, { status: 400 });
    }

    const apiKey = process.env.SUNO_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "SUNO_API_KEY not configured" }, { status: 500 });
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

    const response = await fetch(`${sunoApiBase}/api/v1/generate`, {
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
