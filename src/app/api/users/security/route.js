import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/mongoose";
import User from "@/models/User";

// Helper to get authenticated user ID from cookie
async function getAuthenticatedUserId(request) {
  const token = request.cookies.get("admin_token")?.value;
  if (!token) return null;

  const secret = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-fallback-key-change-me");
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.id;
  } catch (err) {
    return null;
  }
}

export async function POST(request) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { currentPassword, newEmail, newPassword } = await request.json();

    if (!currentPassword) {
      return NextResponse.json({ error: "Current password is required" }, { status: 400 });
    }
    if (!newEmail && !newPassword) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    await dbConnect();
    const user = await User.findById(userId);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return NextResponse.json({ error: "Incorrect current password" }, { status: 400 });
    }

    // Update email if provided
    if (newEmail && newEmail !== user.email) {
      const existing = await User.findOne({ email: newEmail, _id: { $ne: userId } });
      if (existing) {
        return NextResponse.json({ error: "Email already in use" }, { status: 400 });
      }
      user.email = newEmail;
    }

    // Update password if provided
    if (newPassword) {
      if (newPassword.length < 6) {
        return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
      }
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
    }

    await user.save();

    return NextResponse.json({ success: true, message: "Security settings updated successfully" }, { status: 200 });
  } catch (error) {
    console.error("[UpdateSecurity] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
