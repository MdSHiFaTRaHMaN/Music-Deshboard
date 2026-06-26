import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import dbConnect from "@/lib/mongoose";
import Settings from "@/models/Settings";
import { clearSettingsCache } from "@/lib/getSettings";

// Helper to get payload
async function getAdminPayload(request) {
  const token = request.cookies.get("admin_token")?.value;
  if (!token) return null;
  const secret = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-fallback-key-change-me");
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (err) {
    return null;
  }
}

export async function GET(request) {
  try {
    const payload = await getAdminPayload(request);
    if (!payload || payload.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Only admins can view settings" }, { status: 403 });
    }

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
    const payload = await getAdminPayload(request);
    if (!payload || payload.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Only admins can update settings" }, { status: 403 });
    }

    const data = await request.json();
    await dbConnect();

    // Since we only want one settings document, we use findOneAndUpdate
    // with upsert: true and an empty filter.
    const settings = await Settings.findOneAndUpdate(
      {}, // filter (empty means the first doc it finds, or create one if none)
      { $set: data },
      { new: true, upsert: true }
    );

    clearSettingsCache();

    return NextResponse.json({ message: "Settings updated successfully", settings }, { status: 200 });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json({ message: "Error updating settings", error: error.message }, { status: 500 });
  }
}
