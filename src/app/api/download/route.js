import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  let filename = searchParams.get("filename") || "custom-song.mp3";

  if (!url) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  // Ensure it has .mp3 extension
  if (!filename.toLowerCase().endsWith(".mp3")) {
    filename += ".mp3";
  }

  // Basic sanitize for filename
  filename = filename.replace(/[^a-zA-Z0-9-_\. ]/g, "").trim();

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return new NextResponse("Failed to fetch audio from source", { status: 502 });
    }

    // Stream the audio response back to the client as an attachment
    return new NextResponse(response.body, {
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": response.headers.get("Content-Type") || "audio/mpeg",
      },
    });
  } catch (error) {
    console.error("[Download API] Error:", error);
    return new NextResponse("Download failed", { status: 500 });
  }
}
