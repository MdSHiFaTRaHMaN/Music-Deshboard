import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import dbConnect from "@/lib/mongoose";
import User from "@/models/User";

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    
    // 1. Verify that the request is from an admin
    const token = request.cookies.get("admin_token")?.value;
    
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-fallback-key-change-me");
    let payload;
    try {
      const { payload: jwtPayload } = await jwtVerify(token, secret);
      payload = jwtPayload;
    } catch (err) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    if (payload.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Only admins can update users" }, { status: 403 });
    }

    // 2. Extract update fields
    const { name, email, role, status, phone, designation } = await request.json();

    if (!name || !email || !role || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 3. Connect to DB and update user
    await dbConnect();
    
    // Check if email is already taken by another user
    const existingUserWithEmail = await User.findOne({ email, _id: { $ne: id } });
    if (existingUserWithEmail) {
      return NextResponse.json({ error: "Email is already in use by another account" }, { status: 400 });
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      {
        name,
        email,
        role,
        status,
        phone,
        designation
      },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, user: updatedUser }, { status: 200 });
  } catch (error) {
    console.error("[UpdateUser] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    
    // 1. Verify that the request is from an admin
    const token = request.cookies.get("admin_token")?.value;
    
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-fallback-key-change-me");
    let payload;
    try {
      const { payload: jwtPayload } = await jwtVerify(token, secret);
      payload = jwtPayload;
    } catch (err) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    if (payload.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Only admins can delete users" }, { status: 403 });
    }

    // 2. Connect to DB
    await dbConnect();
    
    const userToDelete = await User.findById(id);
    if (!userToDelete) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (userToDelete.role === "admin") {
      return NextResponse.json({ error: "Cannot delete an admin account" }, { status: 403 });
    }

    await User.findByIdAndDelete(id);

    return NextResponse.json({ success: true, message: "User deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("[DeleteUser] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
