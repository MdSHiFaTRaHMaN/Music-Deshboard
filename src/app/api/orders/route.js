import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Order from "@/models/Order";

export async function POST(request) {
  try {
    await dbConnect();

    const body = await request.json();
    const { formData, musicTracks, taskId } = body;

    if (!formData?.email || !taskId) {
      return NextResponse.json(
        { error: "Email and taskId are required" },
        { status: 400 }
      );
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
          // Do not overwrite status if it's already updated to something else like "paid"
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error("[orders] POST Error:", error);
    return NextResponse.json(
      { error: "Failed to save order to database" },
      { status: 500 }
    );
  }
}
