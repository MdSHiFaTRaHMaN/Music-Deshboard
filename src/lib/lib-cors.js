import { NextResponse } from "next/server";

/**
 * Shared CORS helper for API routes called cross-origin from the Shopify storefront.
 *
 * Usage in a route file:
 *
 *   import { withCORS, handleOptions } from "@/lib/cors";
 *
 *   export async function OPTIONS(request) {
 *     return handleOptions(request);
 *   }
 *
 *   export async function GET(request) {
 *     const origin = request.headers.get("origin") || "";
 *     ...
 *     return withCORS(NextResponse.json({ success: true, data }), origin);
 *   }
 */

// Add every domain that is allowed to call this API from the browser.
const ALLOWED_ORIGINS = [
  "https://myownsongs.com",
  "https://www.myownsongs.com",
  "https://myownsongs.com/pages/generate",
  "http://localhost:3000",
  "http://localhost:3001",
].filter(Boolean);

function resolveAllowedOrigin(origin) {
  if (!origin) return null;
  // Exact match against the allow-list. Avoids reflecting arbitrary origins.
  return ALLOWED_ORIGINS.includes(origin) ? origin : null;
}

export function withCORS(response, origin) {
  const allowed = resolveAllowedOrigin(origin);
  if (allowed) {
    response.headers.set("Access-Control-Allow-Origin", allowed);
  }
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.headers.set("Vary", "Origin");
  return response;
}

export function handleOptions(request) {
  const origin = request.headers.get("origin") || "";
  return withCORS(new NextResponse(null, { status: 204 }), origin);
}
