import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import GenerateOption from "@/models/GenerateOption";
import { withCORS, handleOptions } from "@/lib/cors";

const defaultOptions = {
  occasions: [
    "Love", "Father's Day", "Mother's Day", "Birthday",
    "Anniversary", "Wedding", "Birth", "Retirement",
    "Thank You", "Farewell", "Graduation", "Other"
  ],
  genres: [
    "Pop", "Acoustic", "Rock", "Country", "Jazz",
    "R&B/Soul", "EDM", "Hip-Hop", "Classical", "Latin"
  ],
  voices: ["Male", "Female", "Duet"],
  moods: ["Romantic", "Energetic", "Calm", "Inspiring", "Festive", "Emotional", "Powerful"],
  packages: [
    {
      id: "muziekbox", title: "Muziekbox", price: "€59.95", tagline: "Perfect as a gift!",
      features: ["Beautiful physical music box", "High quality audio", "Fast shipping"],
      image: "https://placehold.co/400x400/f8f9fa/101828?text=Muziekbox",
      shopifyProductId: "", shopifyVariantId: ""
    },
    {
      id: "digitaal", title: "Digitaal Liedje", price: "€29.95", tagline: "Ideal for a quick surprise",
      features: ["Digital MP3 download", "Custom lyrics included", "Direct in your inbox"],
      image: "https://placehold.co/400x400/f8f9fa/101828?text=Digitaal+Liedje",
      shopifyProductId: "", shopifyVariantId: ""
    },
    {
      id: "video", title: "Video + Liedje", price: "€69.95", tagline: "New!",
      features: ["Personalized video", "Digital MP3 included", "Perfect for sharing"],
      image: "https://placehold.co/400x400/f8f9fa/101828?text=Video+%2B+Liedje",
      shopifyProductId: "", shopifyVariantId: ""
    }
  ]
};

// Preflight — the browser sends this automatically before the real GET/PUT.
// Without this, the actual request never goes out and shows up as a CORS error.
export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function GET(request) {
  const origin = request.headers.get("origin") || "";
  try {
    await dbConnect();

    // Check if options exist
    let options = await GenerateOption.findOne();

    // If no options exist, create them with defaults
    if (!options) {
      options = await GenerateOption.create(defaultOptions);
    }

    return withCORS(
      NextResponse.json({ success: true, data: options }, { status: 200 }),
      origin
    );
  } catch (error) {
    console.error("[GetFormOptions] Error:", error);
    return withCORS(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      origin
    );
  }
}

export async function PUT(request) {
  const origin = request.headers.get("origin") || "";
  try {
    const data = await request.json();
    await dbConnect();

    let options = await GenerateOption.findOne();

    if (!options) {
      options = new GenerateOption();
    }

    // Update fields
    if (data.occasions) options.occasions = data.occasions;
    if (data.genres) options.genres = data.genres;
    if (data.voices) options.voices = data.voices;
    if (data.moods) options.moods = data.moods;
    if (data.packages) options.packages = data.packages;

    await options.save();

    return withCORS(
      NextResponse.json({ success: true, data: options }, { status: 200 }),
      origin
    );
  } catch (error) {
    console.error("[UpdateFormOptions] Error:", error);
    return withCORS(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      origin
    );
  }
}