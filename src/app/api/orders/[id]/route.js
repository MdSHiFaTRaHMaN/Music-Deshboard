import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Order from "@/models/Order";

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await dbConnect();

    const deletedOrder = await Order.findByIdAndDelete(id);

    if (!deletedOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Order deleted successfully" });
  } catch (error) {
    console.error("Delete order error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
