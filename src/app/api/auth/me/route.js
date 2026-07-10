import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
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

export async function GET(request) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, user }, { status: 200 });
  } catch (error) {
    console.error("[GetMe] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();

    await dbConnect();
    
    // Check if updating email, and if it's already in use
    if (data.email) {
      const existingEmail = await User.findOne({ email: data.email, _id: { $ne: userId } });
      if (existingEmail) {
        return NextResponse.json({ error: "Email already in use" }, { status: 400 });
      }
    }

    // Only allow specific fields to be updated by the user themselves
    const allowedUpdates = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      designation: data.designation,
      bio: data.bio,
      address: data.address,
      socialLinks: data.socialLinks,
      avatar: data.avatar,
    };

    // Remove undefined fields so they aren't overwritten with null
    Object.keys(allowedUpdates).forEach(key => {
      if (allowedUpdates[key] === undefined) delete allowedUpdates[key];
    });

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: allowedUpdates },
      { returnDocument: 'after', runValidators: true }
    ).select("-password");

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, user }, { status: 200 });
  } catch (error) {
    console.error("[UpdateMe] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
