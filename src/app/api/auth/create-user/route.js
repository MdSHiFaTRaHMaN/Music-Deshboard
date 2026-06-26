import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/mongoose";
import User from "@/models/User";

export async function POST(request) {
  try {
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
      return NextResponse.json({ error: "Forbidden: Only admins can create users" }, { status: 403 });
    }

    // 2. Extract user details from the request
    const { name, email, password, role, phone, designation } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
    }

    // 3. Connect to DB and check if user already exists
    await dbConnect();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 400 });
    }

    // 4. Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 5. Create new user
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role: role || "staff",
      phone: phone || "",
      designation: designation || "",
    });

    await newUser.save();

    return NextResponse.json({ success: true, message: "User created successfully" }, { status: 201 });
  } catch (error) {
    console.error("[CreateUser] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
