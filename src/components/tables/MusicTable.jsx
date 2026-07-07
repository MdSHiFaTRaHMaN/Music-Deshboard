"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";
import Badge from "../ui/badge/Badge";

export default function MusicTable({ orders }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  async function handleSyncShopify() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await fetch("/api/shopify/sync-status", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSyncMsg(data.message || "Synced!");
        router.refresh(); // Re-fetch server data
      } else {
        setSyncMsg(data.error || "Sync failed");
      }
    } catch {
      setSyncMsg("Network error");
    } finally {
      setSyncing(false);
    }
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        No musics found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
      <div className="max-w-full overflow-x-auto">
        <div className="min-w-[1102px]">
          <Table>
            {/* Table Header */}
            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
              <TableRow>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                  Customer
                </TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                  Occasion & Style
                </TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                  Package
                </TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                  Selected Song
                </TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                  Status
                </TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400">
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>

            {/* Table Body */}
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {orders.map((order) => {
                const selectedTrack = order.musicTracks?.find(t => t.id === order.selectedDemo) || order.musicTracks?.[0];
                const audioUrl = selectedTrack?.audioUrl || selectedTrack?.streamAudioUrl;
                const filename = `${order.occasion || "music"}-${order.recipientName || order.email || "song"}.mp3`.replace(/\s+/g, "_");

                return (
                  <TableRow key={order._id}>
                    {/* Customer */}
                    <TableCell className="px-5 py-4 sm:px-6 text-start">
                      <span className="block font-medium text-gray-800 text-theme-sm dark:text-white/90">
                        {order.email}
                      </span>
                      <span className="block text-gray-500 text-theme-xs dark:text-gray-400">
                        {order.forWho === "specific" ? `For: ${order.recipientName}` : "General"}
                      </span>
                    </TableCell>

                    {/* Occasion & Style */}
                    <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                      <span className="block font-medium text-gray-800 dark:text-white/90">
                        {order.occasion || "N/A"}
                      </span>
                      <span className="block text-theme-xs capitalize">
                        {[order.genre, order.voice, order.mood].filter(Boolean).join(" • ")}
                      </span>
                    </TableCell>

                    {/* Package */}
                    <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400 uppercase">
                      {order.selectedPackage || "None"}
                    </TableCell>

                    {/* Selected Song - audio player only, no download here */}
                    <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                      {audioUrl ? (
                        <span className="text-xs text-gray-400 italic">Audio available</span>
                      ) : (
                        <span className="text-gray-400 text-xs">No audio</span>
                      )}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                      <Badge
                        size="sm"
                        color={
                          order.status === "paid"
                            ? "success"
                            : order.status === "in_cart"
                              ? "info"
                              : order.status === "created"
                                ? "light"
                                : (order.status === "pending" || order.status === "pending_payment")
                                  ? "warning"
                                  : "error"
                        }
                      >
                        {order.status === "created"
                          ? "Created"
                          : order.status === "in_cart"
                            ? "In Cart"
                            : (order.status === "pending" || order.status === "pending_payment")
                              ? "Payment Pending"
                              : order.status === "paid"
                                ? "Paid"
                                : order.status}
                      </Badge>
                    </TableCell>

                    {/* Actions - Download + Detail */}
                    <TableCell className="px-4 py-3 text-start">
                      <div className="flex flex-col items-center justify-center gap-2">

                        {/* Detail Link */}
                        <Link
                          href={`/all-musics/${order._id}`}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-200 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.07]"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                          </svg>
                          Details
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
