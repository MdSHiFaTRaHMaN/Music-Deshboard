import { NextResponse } from "next/server";
import { SignJWT } from "jose";

export async function POST(request) {
  try {
    const { email, password, keepLoggedIn } = await request.json();

    const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

    if (email === adminEmail && password === adminPassword) {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-fallback-key-change-me");
      
      // Expire in 30 days if keepLoggedIn is true, else 1 day
      const expiresInDays = keepLoggedIn ? 30 : 1;
      
      const token = await new SignJWT({ email, role: "admin" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(`${expiresInDays}d`)
        .sign(secret);

      const response = NextResponse.json({ success: true }, { status: 200 });
      
      response.cookies.set("admin_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: expiresInDays * 24 * 60 * 60, // in seconds
      });

      return response;
    }

    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  } catch (error) {
    console.error("[Login] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
