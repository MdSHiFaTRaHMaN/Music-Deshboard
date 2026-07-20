import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Notification from "@/models/Notification";

export async function GET() {
  try {
    await dbConnect();
    // Fetch the latest 30 notifications, newest first
    const notifications = await Notification.find({})
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();
    
    // Count unread
    const unreadCount = notifications.filter(n => !n.isRead).length;

    return NextResponse.json({ notifications, unreadCount }, { status: 200 });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({ message: "Error fetching notifications", error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    await dbConnect();
    const data = await request.json();

    if (data.action === "mark_all_read") {
      await Notification.updateMany({ isRead: false }, { $set: { isRead: true } });
      return NextResponse.json({ message: "All notifications marked as read" }, { status: 200 });
    }

    if (data.notificationId) {
      await Notification.findByIdAndUpdate(data.notificationId, { $set: { isRead: true } }, { returnDocument: 'after' });
      return NextResponse.json({ message: "Notification marked as read" }, { status: 200 });
    }

    return NextResponse.json({ message: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating notification:", error);
    return NextResponse.json({ message: "Error updating notification", error: error.message }, { status: 500 });
  }
}
