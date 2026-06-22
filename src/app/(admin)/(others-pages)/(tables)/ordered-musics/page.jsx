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
  let orders = await Order.find({ 
    $or: [
      { status: "paid" },
      { selectedPackage: { $exists: true, $ne: null } }
    ]
  }).sort({ createdAt: -1 }).lean();

  // Auto-sync missing audioUrls from Suno API for orders that were closed too early
  const apiKey = process.env.SUNO_API_KEY;
  if (apiKey) {
    const ordersToSync = orders.filter(o => 
      o.taskId && 
      o.musicTracks?.length > 0 && 
      o.musicTracks.some(t => !t.audioUrl || !t.duration)
    );

    for (const order of ordersToSync) {
      try {
        const response = await fetch(`${process.env.SUNO_API_BASE}/api/v1/generate/record-info?taskId=${order.taskId}`, {
          headers: { "Authorization": `Bearer ${apiKey}` },
          cache: "no-store"
        });
        const data = await response.json();
        const sunoData = data?.data?.response?.sunoData;
        
        if (sunoData && sunoData.length > 0) {
          const allTracksReady = sunoData.every(t => t.audioUrl && t.duration);
          if (allTracksReady) {
            const updatedTracks = sunoData.map(track => ({
              id: track.id,
              title: track.title,
              audioUrl: track.audioUrl,
              streamAudioUrl: track.streamAudioUrl,
              imageUrl: track.imageUrl,
              duration: track.duration,
              lyrics: track.prompt,
            }));
            await Order.updateOne({ _id: order._id }, { $set: { musicTracks: updatedTracks } });
            order.musicTracks = updatedTracks; // Update local reference for immediate UI render
          }
        }
      } catch (err) {
        console.error("Auto-sync error on ordered-musics page:", err);
      }
    }
  }

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
