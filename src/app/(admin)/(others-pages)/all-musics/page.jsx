import ComponentCard from "@/components/common/ComponentCard";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import MusicTable from "@/components/tables/MusicTable";
import React from "react";
import dbConnect from "@/lib/mongoose";
import Order from "@/models/Order";
import { getSettings } from "@/lib/getSettings";

export const metadata = {
  title: "All Musics | My Own Music",
  description: "View all generated custom musics, including those pending checkout.",
};

export const dynamic = "force-dynamic"; // Ensures it fetches latest data on reload

export default async function AllMusics() {
  await dbConnect();
  
  // Fetch all orders regardless of status
  let orders = await Order.find({}).sort({ createdAt: -1 }).lean();

  // ── Auto-sync Shopify payment statuses on every page load ──
  try {
    const settings = await getSettings();
    if (settings.shopUrl1 && settings.shopifyAdminApiKey) {
      let shopUrl = settings.shopUrl1;
      if (!shopUrl.startsWith("http")) shopUrl = `https://${shopUrl}`;

      const shopifyRes = await fetch(
        `${shopUrl}/admin/api/2024-04/orders.json?status=any&limit=250`,
        {
          headers: {
            "X-Shopify-Access-Token": settings.shopifyAdminApiKey,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        }
      );

      if (shopifyRes.ok) {
        const shopifyData = await shopifyRes.json();
        for (const shopifyOrder of shopifyData.orders || []) {
          const financialStatus = shopifyOrder.financial_status;
          if (!financialStatus) continue;

          let musicIdMatched = false;
          for (const item of shopifyOrder.line_items || []) {
            const musicIdProp = (item.properties || []).find(
              (p) => ["_musicid", "musicid", "music id"].includes(p.name?.toLowerCase())
            );
            if (musicIdProp?.value) {
              await Order.findOneAndUpdate(
                { musicId: musicIdProp.value },
                { $set: { status: financialStatus } },
                { returnDocument: 'after' }
              );
              musicIdMatched = true;
            }
          }

          // Fallback: match by email if no musicId property
          if (!musicIdMatched && shopifyOrder.email) {
            await Order.updateMany(
              {
                email: shopifyOrder.email,
                status: { $in: ["in_cart", "created", "pending_payment"] },
              },
              { $set: { status: financialStatus } }
            );
          }
        }
      }
    }
  } catch (syncErr) {
    console.error("[all-musics] Shopify auto-sync error:", syncErr);
  }

  // Re-fetch after sync so we have the latest statuses
  orders = await Order.find({}).sort({ createdAt: -1 }).lean();

  // Auto-sync missing audioUrls from Suno API for pending orders that were closed too early
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
        console.error("Auto-sync error on all-musics page:", err);
      }
    }
  }

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
