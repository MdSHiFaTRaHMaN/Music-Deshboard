import ComponentCard from "@/components/common/ComponentCard";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import MusicTable from "@/components/tables/MusicTable";
import React from "react";
import dbConnect from "@/lib/mongoose";
import Order from "@/models/Order";

export const metadata = {
  title: "Ordered Musics | TailAdmin - Next.js Dashboard Template",
  description: "View all paid and ordered custom musics.",
};

export const dynamic = "force-dynamic"; // Ensures it fetches latest data on reload

export default async function OrderedMusics() {
  await dbConnect();
  
  // For now, we assume "Ordered" means status is "paid", or they selected a package
  // We'll fetch where selectedPackage exists or status is paid.
  // We can easily tweak this filter when Shopify is integrated.
  const orders = await Order.find({ 
    $or: [
      { status: "paid" },
      { selectedPackage: { $exists: true, $ne: null } }
    ]
  }).sort({ createdAt: -1 }).lean();

  // Lean returns POJOs, but deeply nested ObjectIds (like in musicTracks) break Next.js server components
  // We strictly serialize the entire object to plain JSON types
  const serializedOrders = JSON.parse(JSON.stringify(orders));

  return (
    <div>
      <PageBreadcrumb pageTitle="Ordered Musics" />
      <div className="space-y-6">
        <ComponentCard title="Customers who placed an order">
          <MusicTable orders={serializedOrders} />
        </ComponentCard>
      </div>
    </div>
  );
}
