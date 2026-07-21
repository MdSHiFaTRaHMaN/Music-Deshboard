import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Customer from "@/models/Customer";
import { jwtVerify } from "jose";

export async function PUT(request) {
  try {
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

    const { email, isBlocked, blockReason } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    await dbConnect();

    // Upsert customer
    const customer = await Customer.findOneAndUpdate(
      { email },
      { $set: { isBlocked, blockReason: blockReason || "" } },
      { upsert: true, returnDocument: 'after' }
    );

    return NextResponse.json({ success: true, customer }, { status: 200 });
  } catch (error) {
    console.error("[BlockCustomer] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
