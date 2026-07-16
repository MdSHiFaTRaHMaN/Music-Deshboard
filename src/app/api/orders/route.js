import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Order from "@/models/Order";
import { withCORS, handleOptions } from "@/lib/cors";
import { decryptTaskId } from "@/lib/encryption";

// Preflight — the browser sends this automatically before the real POST.
export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function POST(request) {
  const origin = request.headers.get("origin") || "";
  try {
    await dbConnect();

    const body = await request.json();
    const { formData, musicTracks, taskId: rawTaskId, musicId, productId, variantId } = body;
    // Always use the raw (decrypted) taskId for DB operations
    const taskId = decryptTaskId(rawTaskId);

    if (!formData?.email || !taskId) {
      return withCORS(
        NextResponse.json(
          { error: "Email and taskId are required" },
          { status: 400 }
        ),
        origin
      );
    }

    const existingOrder = await Order.findOne({ email: formData.email, taskId: taskId });
    let newStatus = existingOrder?.status || "created";

    // If they selected a package and the order isn't already paid or pending from Shopify, mark it as in_cart
    if (formData.selectedPackage && (newStatus === "created" || newStatus === "pending_payment")) {
      newStatus = "in_cart";
    }

    // Upsert the order: if it already exists for this taskId and email, update it.
    // Otherwise, create a new record.
    const order = await Order.findOneAndUpdate(
      { email: formData.email, taskId: taskId },
      {
        $set: {
          occasion: formData.occasion,
          forWho: formData.forWho,
          recipientName: formData.recipientName,
          genre: formData.genre,
          voice: formData.voice,
          mood: formData.mood,
          lyrics: formData.lyrics,
          selectedDemo: formData.selectedDemo,
          selectedPackage: formData.selectedPackage,
          orderNotes: formData.orderNotes,
          musicId: musicId || undefined, // opaque public ID — maps back to this taskId for support/admin lookups
          shopifyProductId: productId || undefined,
          shopifyVariantId: variantId || undefined,
          status: newStatus,
        },
      },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
    );

    return withCORS(NextResponse.json({ success: true, order }), origin);
  } catch (error) {
    console.error("[orders] POST Error:", error);
    return withCORS(
      NextResponse.json(
        { error: "Failed to save order to database" },
        { status: 500 }
      ),
      origin
    );
  }
}