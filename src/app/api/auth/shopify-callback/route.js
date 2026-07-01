import { NextResponse } from "next/server";
import crypto from "crypto";
import { SignJWT } from "jose";
import dbConnect from "@/lib/mongoose";
import Settings from "@/models/Settings";
import User from "@/models/User";

function verifyHmac(query, secret) {
  const hmac = query.hmac;
  if (!hmac) return false;

  const { hmac: _, ...rest } = query;
  
  const message = Object.keys(rest)
    .sort()
    .map(key => `${key}=${rest[key]}`)
    .join('&');

  const generatedHmac = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(generatedHmac), Buffer.from(hmac));
  } catch (e) {
    return false;
  }
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const query = Object.fromEntries(url.searchParams.entries());

    const protocol = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '');
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host;
    const baseUrl = `${protocol}://${host}`;

    if (!query.hmac || !query.shop) {
      return NextResponse.redirect(new URL("/signin?error=MissingShopifyParams", baseUrl));
    }

    await dbConnect();
    
    // Fetch Shopify Secret ID from Settings
    const settings = await Settings.findOne({});
    if (!settings || !settings.shopifySecretId) {
      console.error("[Shopify Auth] Shopify Secret ID is not configured in Settings.");
      return NextResponse.redirect(new URL("/signin?error=ShopifyNotConfigured", baseUrl));
    }

    // Verify the HMAC
    const isValid = verifyHmac(query, settings.shopifySecretId);

    if (!isValid) {
      console.error("[Shopify Auth] Invalid HMAC signature.");
      return NextResponse.redirect(new URL("/signin?error=InvalidHMAC", baseUrl));
    }

    // Since this request is legitimately from Shopify, auto-login as an admin.
    // Let's find an active admin user.
    const adminUser = await User.findOne({ role: "admin", status: "active" });

    if (!adminUser) {
      console.error("[Shopify Auth] No active admin user found in database.");
      return NextResponse.redirect(new URL("/signin?error=NoAdminFound", baseUrl));
    }

    // Generate JWT token
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-fallback-key-change-me");
    const token = await new SignJWT({ 
      id: adminUser._id.toString(),
      email: adminUser.email, 
      role: adminUser.role,
      name: adminUser.name
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`30d`)
      .sign(secret);

    // Redirect to Dashboard (or the originally requested path if we preserved it)
    const response = NextResponse.redirect(new URL("/", baseUrl));

    // Set the cookie with SameSite=None so it works inside the Shopify iframe
    response.cookies.set("admin_token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // in seconds
    });

    return response;

  } catch (error) {
    console.error("[Shopify Auth] Internal Error:", error);
    return NextResponse.redirect(new URL("/signin?error=InternalServerError", baseUrl));
  }
}
