import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import GenerateOption from "@/models/GenerateOption";

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
      image: "https://placehold.co/400x400/f8f9fa/101828?text=Muziekbox"
    },
    {
      id: "digitaal", title: "Digitaal Liedje", price: "€29.95", tagline: "Ideal for a quick surprise",
      features: ["Digital MP3 download", "Custom lyrics included", "Direct in your inbox"],
      image: "https://placehold.co/400x400/f8f9fa/101828?text=Digitaal+Liedje"
    },
    {
      id: "video", title: "Video + Liedje", price: "€69.95", tagline: "New!",
      features: ["Personalized video", "Digital MP3 included", "Perfect for sharing"],
      image: "https://placehold.co/400x400/f8f9fa/101828?text=Video+%2B+Liedje"
    }
  ]
};

export async function GET(request) {
  try {
    await dbConnect();
    
    // Check if options exist
    let options = await GenerateOption.findOne();
    
    // If no options exist, create them with defaults
    if (!options) {
      options = await GenerateOption.create(defaultOptions);
    }
    
    return NextResponse.json({ success: true, data: options }, { status: 200 });
  } catch (error) {
    console.error("[GetFormOptions] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request) {
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
    
    return NextResponse.json({ success: true, data: options }, { status: 200 });
  } catch (error) {
    console.error("[UpdateFormOptions] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
