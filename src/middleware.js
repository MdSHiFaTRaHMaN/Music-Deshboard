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
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images etc)
     */
    "/((?!_next/static|_next/image|favicon.ico|images).*)",
  ],
};
