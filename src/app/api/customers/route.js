import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Order from "@/models/Order";
import Customer from "@/models/Customer";
import { jwtVerify } from "jose";

export const dynamic = "force-dynamic";

export async function GET(request) {
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

    await dbConnect();

    // Group orders by email
    const aggregatedData = await Order.aggregate([
      {
        $group: {
          _id: "$email",
          totalOrders: { $sum: 1 },
          lastOrderDate: { $max: "$createdAt" },
        }
      },
      {
        $sort: { lastOrderDate: -1 }
      }
    ]);

    // Fetch existing customers to merge block states
    const customers = await Customer.find({});
    const customerMap = customers.reduce((acc, c) => {
      acc[c.email] = c;
      return acc;
    }, {});

    const results = aggregatedData.map(group => {
      const email = group._id;
      const c = customerMap[email];
      return {
        email: email,
        totalOrders: group.totalOrders,
        lastOrderDate: group.lastOrderDate,
        isBlocked: c ? c.isBlocked : false,
        blockReason: c ? c.blockReason : "",
        securityFlags: c ? c.securityFlags : 0,
        knownIps: c ? c.knownIps : [],
      };
    });

    return NextResponse.json({ success: true, customers: results }, { status: 200 });
  } catch (error) {
    console.error("[GetCustomers] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
