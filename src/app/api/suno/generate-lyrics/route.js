import { NextResponse } from "next/server";

// Correct base URL from official docs: https://api.sunoapi.org
const sunoApiBase = process.env.SUNO_API_BASE;

export async function POST(request) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const apiKey = process.env.SUNO_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "SUNO_API_KEY not configured" }, { status: 500 });
    }

    // POST /api/v1/lyrics — requires prompt AND callBackUrl (required by API)
    // We use a placeholder callback URL since we poll manually via record-info
    const callBackUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://example.com"}/api/suno/callback`;

    const response = await fetch(`${sunoApiBase}/api/v1/lyrics`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt,      // max 200 characters
        callBackUrl, // required field
      }),
    });

    // Response shape: { code: 200, msg: "success", data: { taskId: "..." } }
    const data = await response.json();
    console.log("[generate-lyrics] Response:", JSON.stringify(data));

    if (data.code !== 200) {
      return NextResponse.json(
        { error: data.msg || "Failed to generate lyrics" },
        { status: 400 }
      );
    }

    // Return taskId for client to poll
    return NextResponse.json({ taskId: data.data?.taskId });
  } catch (error) {
    console.error("[generate-lyrics] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
