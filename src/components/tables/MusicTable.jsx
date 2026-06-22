"use client";
import React from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";
import Badge from "../ui/badge/Badge";

function handleDownload(url, filename) {
  fetch(url)
    .then((res) => res.blob())
    .then((blob) => {
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename || "music.mp3";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    })
    .catch(() => {
      // fallback: open in new tab
      window.open(url, "_blank");
    });
}

export default function MusicTable({ orders }) {
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
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
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
                            : order.status === "pending_payment"
                              ? "warning"
                              : "error"
                        }
                      >
                        {order.status}
                      </Badge>
                    </TableCell>

                    {/* Actions - Download + Detail */}
                    <TableCell className="px-4 py-3 text-start">
                      <div className="flex flex-col gap-2">
                        {/* Download Button */}
                        {audioUrl ? (
                          <button
                            onClick={() => handleDownload(audioUrl, filename)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-500 transition-colors hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-400 dark:hover:bg-brand-500/20"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Download
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}

                        {/* Detail Link */}
                        <Link
                          href={`/all-musics/${order._id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.07]"
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
