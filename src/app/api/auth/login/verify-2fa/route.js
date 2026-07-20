import { NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";
import speakeasy from "speakeasy";
import dbConnect from "@/lib/mongoose";
import User from "@/models/User";

export async function POST(request) {
  try {
    const { tempToken, code } = await request.json();

    if (!tempToken || !code) {
      return NextResponse.json({ error: "Token and code are required" }, { status: 400 });
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-fallback-key-change-me");
    let payload;

    try {
      const verified = await jwtVerify(tempToken, secret);
      payload = verified.payload;
    } catch (err) {
      return NextResponse.json({ error: "Session expired. Please log in again." }, { status: 401 });
    }

    if (!payload.tempAuth || !payload.id) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    await dbConnect();
    const user = await User.findById(payload.id);

    if (!user || !user.isTwoFactorEnabled) {
      return NextResponse.json({ error: "Invalid user or 2FA not enabled" }, { status: 400 });
    }

    // Verify 2FA code
    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code
    });

    if (!isValid) {
      return NextResponse.json({ error: "Invalid 2FA code" }, { status: 401 });
    }

    // Generate final token
    const keepLoggedIn = payload.keepLoggedIn;
    const expiresInDays = keepLoggedIn ? 30 : 1;
    
    const token = await new SignJWT({ 
      id: user._id.toString(),
      email: user.email, 
      role: user.role,
      name: user.name
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${expiresInDays}d`)
      .sign(secret);

    const response = NextResponse.json({ success: true, role: user.role }, { status: 200 });
    
    response.cookies.set("admin_token", token, {
      httpOnly: true,
      secure: false, 
      sameSite: "lax", 
      path: "/",
      maxAge: expiresInDays * 24 * 60 * 60, 
    });

    return response;
  } catch (error) {
    console.error("[Verify2FALogin] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
