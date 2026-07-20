import { NextResponse } from "next/server";
import speakeasy from "speakeasy";
import { jwtVerify } from "jose";
import dbConnect from "@/lib/mongoose";
import User from "@/models/User";

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

    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    await dbConnect();
    const user = await User.findById(userId);

    if (!user || !user.twoFactorSecret) {
      return NextResponse.json({ error: "2FA setup not initiated" }, { status: 400 });
    }

    // Verify token
    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token
    });

    if (isValid) {
      user.isTwoFactorEnabled = true;
      await user.save();
      return NextResponse.json({ success: true }, { status: 200 });
    } else {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }
  } catch (error) {
    console.error("[Verify2FA] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
