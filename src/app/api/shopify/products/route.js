import { NextResponse } from "next/server";
import { getSettings } from "@/lib/getSettings";
import { jwtVerify } from "jose";

export async function GET(request) {
  try {
    // Auth check
    const token = request.cookies.get("admin_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-fallback-key-change-me");
      const { payload } = await jwtVerify(token, secret);
      if (payload.role !== "admin" && payload.role !== "staff") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const settings = await getSettings();
    if (!settings.shopUrl1 || !settings.shopifyAdminApiKey) {
      return NextResponse.json({ error: "Shopify API not configured" }, { status: 500 });
    }

    let url = settings.shopUrl1;
    if (!url.startsWith("http")) url = `https://${url}`;

    // Fetch products
    const response = await fetch(`${url}/admin/api/2024-04/products.json?limit=250&fields=id,title,image,variants`, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": settings.shopifyAdminApiKey,
        "Content-Type": "application/json",
      },
      cache: "no-store"
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[Shopify Products Fetch] Failed:", response.status, errText);
      return NextResponse.json({ error: "Failed to fetch products from Shopify" }, { status: 500 });
    }

    const data = await response.json();
    
    // Format the response for the frontend dropdown
    const formattedProducts = [];
    
    if (data.products) {
      for (const product of data.products) {
        const prodImage = product.image?.src || "";
        
        for (const variant of product.variants) {
          formattedProducts.push({
            id: `${product.id}-${variant.id}`, // Unique ID for the dropdown
            productId: product.id.toString(),
            variantId: variant.id.toString(),
            productTitle: product.title,
            variantTitle: variant.title !== "Default Title" ? variant.title : "",
            displayTitle: variant.title !== "Default Title" ? `${product.title} - ${variant.title}` : product.title,
            price: variant.price,
            image: prodImage
          });
        }
      }
    }

    return NextResponse.json({ success: true, products: formattedProducts });
  } catch (error) {
    console.error("[Shopify Products Fetch] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
