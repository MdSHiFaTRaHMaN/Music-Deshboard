import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import dbConnect from "@/lib/mongoose";
import User from "@/models/User";
import bcrypt from "bcryptjs";

// Helper to get authenticated user ID from cookie
async function getAuthenticatedUserId(request) {
  const token = request.cookies.get("admin_token")?.value;
  if (!token) return null;

  const secret = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-fallback-key-change-me");
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.id;
  } catch (err) {
    return null;
  }
}

export async function POST(request) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { password } = await request.json();
    if (!password) {
      return NextResponse.json({ error: "Password is required to disable 2FA" }, { status: 400 });
    }

    await dbConnect();
    const user = await User.findById(userId);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify password first
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 400 });
    }

    user.isTwoFactorEnabled = false;
    user.twoFactorSecret = ""; // Clear the secret for safety
    await user.save();
    
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[Disable2FA] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
