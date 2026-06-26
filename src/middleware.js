import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Define public paths that don't require authentication
  const publicPaths = [
    "/signin",
    "/signup",
    "/genarate",
    "/api/auth/login",
    "/api/suno/generate-music",
    "/api/suno/generate-lyrics",
    "/api/suno/status",
    "/api/orders",
    "/api/form-options", // <-- added: was missing, causing a redirect-to-/signin (307) on every storefront call
    "/api/auth/shopify-callback",
    "/_next", // static files
    "/favicon.ico"
  ];

  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));

  // If it's a public path, let it pass
  if (isPublicPath) {
    return NextResponse.next();
  }

  // Check for the admin token
  const token = request.cookies.get("admin_token")?.value;

  if (!token) {
    if (request.nextUrl.searchParams.has("hmac") && request.nextUrl.searchParams.has("shop")) {
      const callbackUrl = new URL("/api/auth/shopify-callback", request.url);
      callbackUrl.search = request.nextUrl.search;
      return NextResponse.redirect(callbackUrl);
    }
    return NextResponse.redirect(new URL("/signin", request.url));
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-fallback-key-change-me");
    const { payload } = await jwtVerify(token, secret);

    // Role-based protection for specific routes
    if (pathname.startsWith("/create-staff") && payload.role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  } catch (error) {
    // Token is invalid or expired
    return NextResponse.redirect(new URL("/signin", request.url));
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