import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/mongoose";
import User from "@/models/User";

export async function POST(request) {
  try {
    const { email, password, keepLoggedIn } = await request.json();

    await dbConnect();

    // 1. Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // 2. Check if user is active
    if (user.status !== "active") {
      return NextResponse.json({ error: "Account is not active" }, { status: 403 });
    }

    // 3. Compare password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // 4. Update last login
    user.lastLogin = new Date();
    await user.save();

    // 5. Generate token
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-fallback-key-change-me");
    
    // Expire in 30 days if keepLoggedIn is true, else 1 day
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
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: expiresInDays * 24 * 60 * 60, // in seconds
    });

    return response;
  } catch (error) {
    console.error("[Login] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
