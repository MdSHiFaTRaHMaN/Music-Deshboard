import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Order from "@/models/Order";
import { withCORS, handleOptions } from "@/lib/cors";

// Preflight request
export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function DELETE(request, { params }) {
  const origin = request.headers.get("origin") || "";
  try {
    const { id } = await params;
    await dbConnect();

    const deletedOrder = await Order.findByIdAndDelete(id);

    if (!deletedOrder) {
      return withCORS(NextResponse.json({ error: "Order not found" }, { status: 404 }), origin);
    }

    return withCORS(NextResponse.json({ success: true, message: "Order deleted successfully" }), origin);
  } catch (error) {
    console.error("Delete order error:", error);
    return withCORS(NextResponse.json({ error: "Internal server error" }, { status: 500 }), origin);
  }
}

export async function GET(request, { params }) {
  const origin = request.headers.get("origin") || "";
  try {
    const { id } = await params;
    await dbConnect();

    const order = await Order.findById(id).lean();

    if (!order) {
      return withCORS(NextResponse.json({ error: "Order not found" }, { status: 404 }), origin);
    }

    return withCORS(NextResponse.json({ success: true, order }), origin);
  } catch (error) {
    console.error("Get order error:", error);
    return withCORS(NextResponse.json({ error: "Internal server error" }, { status: 500 }), origin);
  }
}
