import ComponentCard from "@/components/common/ComponentCard";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import MusicTable from "@/components/tables/MusicTable";
import React from "react";
import dbConnect from "@/lib/mongoose";
import Order from "@/models/Order";

export const metadata = {
  title: "All Musics | TailAdmin - Next.js Dashboard Template",
  description: "View all generated custom musics, including those pending checkout.",
};

export const dynamic = "force-dynamic"; // Ensures it fetches latest data on reload

export default async function AllMusics() {
  await dbConnect();
  
  // Fetch all orders regardless of status
  const orders = await Order.find({}).sort({ createdAt: -1 }).lean();

  // Lean returns POJOs, but deeply nested ObjectIds (like in musicTracks) break Next.js server components
  // We strictly serialize the entire object to plain JSON types
  const serializedOrders = JSON.parse(JSON.stringify(orders));

  return (
    <div>
      <PageBreadcrumb pageTitle="All Musics" />
      <div className="space-y-6">
        <ComponentCard title="All Generated Songs Database">
          <MusicTable orders={serializedOrders} />
        </ComponentCard>
      </div>
    </div>
  );
}
