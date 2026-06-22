import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Settings from "@/models/Settings";

export async function GET() {
  try {
    await dbConnect();
    let settings = await Settings.findOne({});
    
    if (!settings) {
      settings = await Settings.create({});
    }

    return NextResponse.json(settings, { status: 200 });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json({ message: "Error fetching settings", error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const data = await request.json();
    await dbConnect();

    // Since we only want one settings document, we use findOneAndUpdate
    // with upsert: true and an empty filter.
    const settings = await Settings.findOneAndUpdate(
      {}, // filter (empty means the first doc it finds, or create one if none)
      { $set: data },
      { new: true, upsert: true }
    );

    return NextResponse.json({ message: "Settings updated successfully", settings }, { status: 200 });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json({ message: "Error updating settings", error: error.message }, { status: 500 });
  }
}
