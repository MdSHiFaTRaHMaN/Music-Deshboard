import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const protocol = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host;
  const baseUrl = `${protocol}://${host}`;

  // Check if request is originating from the Shopify storefront
  const origin = request.headers.get('origin') || "";
  const referer = request.headers.get('referer') || "";
  const isFromShopifyStorefront = origin.includes('myownsongs.com') || referer.includes('myownsongs.com');

  // Paths that are ALWAYS public (App & Shopify)
  const alwaysPublicPaths = [
    "/signin",
    "/signup",
    "/api/auth/login",
    "/api/auth/shopify-callback", // Keep Shopify app authentication working
    "/_next", // static files
    "/favicon.ico"
  ];

  // Paths that are public ONLY when requested from the Shopify Storefront
  const shopifyPublicPaths = [
    "/genarate",
    "/api/suno/generate-music",
    "/api/suno/generate-lyrics",
    "/api/suno/status",
    "/api/orders",
    "/api/form-options" // Used by storefront
  ];

  const isAlwaysPublic = alwaysPublicPaths.some(path => pathname.startsWith(path));
  const isShopifyPublic = isFromShopifyStorefront && shopifyPublicPaths.some(path => pathname.startsWith(path));

  // If it's a permitted public path, let it pass without authentication
  if (isAlwaysPublic || isShopifyPublic) {
    return NextResponse.next();
  }

  // Check for the admin token
  const token = request.cookies.get("admin_token")?.value;

  if (!token) {
    if (request.nextUrl.searchParams.has("hmac") && request.nextUrl.searchParams.has("shop")) {
      const callbackUrl = new URL("/api/auth/shopify-callback", baseUrl);
      callbackUrl.search = request.nextUrl.search;
      return NextResponse.redirect(callbackUrl);
    }
    return NextResponse.redirect(new URL("/signin", baseUrl));
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-fallback-key-change-me");
    const { payload } = await jwtVerify(token, secret);

    // Role-based protection for specific routes
    if (pathname.startsWith("/create-staff") && payload.role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // If already authenticated and Shopify params are present, clean the URL
    if (request.nextUrl.searchParams.has("hmac") && request.nextUrl.searchParams.has("shop")) {
      return NextResponse.redirect(new URL("/", baseUrl));
    }

    return NextResponse.next();
  } catch (error) {
    // Token is invalid or expired
    return NextResponse.redirect(new URL("/signin", baseUrl));
  }
}

export const config = {
  matcher: [
    /*
     * IMPORTANT: do NOT exclude all of "api" here — /api/admin/* (and any
     * other admin-only API routes) still need the token check below.
     *
     * Only the specific storefront-facing public paths are excluded, via
     * the `publicPaths` array above (which now includes "/api/form-options").
     * Everything else, including "/api/admin/...", still runs through the
     * full middleware and requires a valid admin_token.
     */
    "/((?!_next/static|_next/image|favicon.ico|images).*)",
  ],
};