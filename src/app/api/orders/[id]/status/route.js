import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Order from "@/models/Order";
import { jwtVerify } from "jose";

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    // Verify admin
    const token = request.cookies.get("admin_token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-fallback-key-change-me");
    let payload;
    try {
      const { payload: jwtPayload } = await jwtVerify(token, secret);
      payload = jwtPayload;
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    if (payload.role !== "admin" && payload.role !== "staff") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { status } = await request.json();

    if (!status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 });
    }

    await dbConnect();
    const order = await Order.findByIdAndUpdate(
      id,
      { $set: { status } },
      { returnDocument: 'after' }
    );

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, order }, { status: 200 });
  } catch (error) {
    console.error("[UpdateOrderStatus] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
