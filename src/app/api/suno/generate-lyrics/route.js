// import { NextResponse } from "next/server";
// import { getSettings } from "@/lib/getSettings";

// export async function POST(request) {
//   try {
//     // ── Security: Origin / Referer check ──
//     const settings = await getSettings();
//     const origin = request.headers.get("origin") || "";
//     const referer = request.headers.get("referer") || "";
//     const allowedOrigins = [
//       settings.shopUrl,
//       process.env.NEXT_PUBLIC_APP_URL,
//       "http://localhost:3000",
//       "http://localhost:3001",
//     ].filter(Boolean);

//     const isAllowed = allowedOrigins.some(
//       (allowed) => origin.startsWith(allowed) || referer.startsWith(allowed)
//     );

//     if (!isAllowed) {
//       return NextResponse.json(
//         { error: "Unauthorized: Request origin not allowed" },
//         { status: 403 }
//       );
//     }

//     const { prompt } = await request.json();

//     if (!prompt) {
//       return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
//     }

//     // ── Use API key from DB (fallback to env) ──
//     const apiKey = settings.sunoApiKey;
//     if (!apiKey) {
//       return NextResponse.json({ error: "SUNO API Key not configured. Please set it in Settings." }, { status: 500 });
//     }

//     // POST /api/v1/lyrics — requires prompt AND callBackUrl (required by API)
//     // We use a placeholder callback URL since we poll manually via record-info
//     const callBackUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://example.com"}/api/suno/callback`;

//     const response = await fetch(`${settings.sunoApiBase}/api/v1/lyrics`, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         "Authorization": `Bearer ${apiKey}`,
//       },
//       body: JSON.stringify({
//         prompt,      // max 200 characters
//         callBackUrl, // required field
//       }),
//     });

//     // Response shape: { code: 200, msg: "success", data: { taskId: "..." } }
//     const data = await response.json();
//     console.log("[generate-lyrics] Response:", JSON.stringify(data));

//     if (data.code !== 200) {
//       return NextResponse.json(
//         { error: data.msg || "Failed to generate lyrics" },
//         { status: 400 }
//       );
//     }

//     // Return taskId for client to poll
//     return NextResponse.json({ taskId: data.data?.taskId });
//   } catch (error) {
//     console.error("[generate-lyrics] Error:", error);
//     return NextResponse.json({ error: "Internal server error" }, { status: 500 });
//   }
// }

import { NextResponse } from "next/server";
import { getSettings } from "@/lib/getSettings";
import { withCORS, handleOptions } from "@/lib/cors";

// Preflight — the browser sends this automatically before the real POST.
export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function POST(request) {
  const origin = request.headers.get("origin") || "";
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

    const isAllowed = allowedOrigins.some(
      (allowed) => originHeader.startsWith(allowed) || refererHeader.startsWith(allowed)
    );

    if (!isAllowed) {
      return withCORS(
        NextResponse.json(
          { error: "Unauthorized: Request origin not allowed" },
          { status: 403 }
        ),
        origin
      );
    }

    const { prompt } = await request.json();

    if (!prompt) {
      return withCORS(NextResponse.json({ error: "Prompt is required" }, { status: 400 }), origin);
    }

    // ── Use API key from DB (fallback to env) ──
    const apiKey = settings.sunoApiKey;
    if (!apiKey) {
      return withCORS(
        NextResponse.json({ error: "SUNO API Key not configured. Please set it in Settings." }, { status: 500 }),
        origin
      );
    }

    // POST /api/v1/lyrics — requires prompt AND callBackUrl (required by API)
    // We use a placeholder callback URL since we poll manually via record-info
    const callBackUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://example.com"}/api/suno/callback`;

    const response = await fetch(`${settings.sunoApiBase}/api/v1/lyrics`, {
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
      return withCORS(
        NextResponse.json(
          { error: data.msg || "Failed to generate lyrics" },
          { status: 400 }
        ),
        origin
      );
    }

    // Return taskId for client to poll
    return withCORS(NextResponse.json({ taskId: data.data?.taskId }), origin);
  } catch (error) {
    console.error("[generate-lyrics] Error:", error);
    return withCORS(NextResponse.json({ error: "Internal server error" }, { status: 500 }), origin);
  }
}