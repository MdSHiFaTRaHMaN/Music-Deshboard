import { NextResponse } from "next/server";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
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

    await dbConnect();
    const user = await User.findById(userId);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate new secret
    const secretInfo = speakeasy.generateSecret({ 
      name: "MyOwnMusic (" + user.email + ")"
    });
    
    // Generate QR code image URL
    const qrCodeUrl = await qrcode.toDataURL(secretInfo.otpauth_url);
    
    // Save the secret temporarily in the user document, but do not enable 2FA yet
    user.twoFactorSecret = secretInfo.base32;
    user.isTwoFactorEnabled = false; 
    await user.save();

    return NextResponse.json({ success: true, qrCodeUrl, secret: secretInfo.base32 }, { status: 200 });
  } catch (error) {
    console.error("[Generate2FA] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
