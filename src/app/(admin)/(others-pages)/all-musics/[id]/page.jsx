import React from "react";
import Link from "next/link";
import dbConnect from "@/lib/mongoose";
import Order from "@/models/Order";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Badge from "@/components/ui/badge/Badge";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/getSettings";
import SyncMusicButton from "@/components/common/SyncMusicButton";
import DeleteOrderButton from "@/components/common/DeleteOrderButton";
import ForceDownloadButton from "@/components/common/ForceDownloadButton";
import { generatePresignedUrl } from "@/lib/s3";

export const dynamic = "force-dynamic";

export default async function MusicDetailPage({ params }) {
  const { id } = await params;
  await dbConnect();
  let order = await Order.findById(id).lean();

  if (!order) return notFound();

  // Auto-sync missing audioUrls from Suno API
  const apiKey = process.env.SUNO_API_KEY;
  if (apiKey && order.taskId && order.musicTracks?.length > 0 && order.musicTracks.some(t => !t.audioUrl || !t.duration)) {
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
          order.musicTracks = updatedTracks; // Update local reference
        }
      }
    } catch (err) {
      console.error("Auto-sync error on all-musics detail page:", err);
    }
  }

  const serialized = JSON.parse(JSON.stringify(order));
  const selectedTrack = serialized.musicTracks?.find(t => t.id === serialized.selectedDemo) || serialized.musicTracks?.[0];

  const needsSync = !!serialized.taskId && (!serialized.musicTracks || serialized.musicTracks.length === 0 || serialized.musicTracks.some(t => !t.audioUrl || !t.duration));

  return (
    <div>
      <PageBreadcrumb pageTitle="Song Details" />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">

        {/* Left: Customer & Order Info */}
        <div className="xl:col-span-2 space-y-6">

          {/* Customer Info */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Customer Information</h3>
              <SyncMusicButton taskId={serialized.taskId} needsSync={needsSync} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                ["Email", serialized.email],
                ["Recipient", serialized.forWho === "specific" ? serialized.recipientName : "General"],
                ["Occasion", serialized.occasion],
                ["Package", serialized.selectedPackage?.toUpperCase() || "None"],
                ["Genre", serialized.genre],
                ["Voice", serialized.voice],
                ["Mood", serialized.mood],
                ["Status", null],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
                  {label === "Status" ? (
                    <Badge
                      size="sm"
                      color={
                        serialized.status === "paid" ? "success"
                          : serialized.status === "pending_payment" ? "warning"
                            : "error"
                      }
                    >
                      {serialized.status}
                    </Badge>
                  ) : (
                    <p className="font-medium text-gray-800 dark:text-white/90">{value || "—"}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {serialized.orderNotes && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h3 className="mb-3 text-lg font-semibold text-gray-800 dark:text-white/90">Order Notes</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{serialized.orderNotes}</p>
            </div>
          )}

          {/* Lyrics */}
          {serialized.lyrics && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h3 className="mb-3 text-lg font-semibold text-gray-800 dark:text-white/90">Song Lyrics</h3>
              <pre className="whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{serialized.lyrics}</pre>
            </div>
          )}

          {/* Story */}
          {serialized.storyText && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h3 className="mb-3 text-lg font-semibold text-gray-800 dark:text-white/90">Customer&apos;s Story</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{serialized.storyText}</p>
            </div>
          )}
        </div>

        {/* Right: Audio Tracks */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90">
              Generated Tracks ({serialized.musicTracks?.length || 0})
            </h3>

            {serialized.musicTracks?.length > 0 ? (
              <div className="space-y-5">
                {serialized.musicTracks.map((track, idx) => {
                  const audioUrl = track.audioUrl || track.streamAudioUrl;
                  const isSelected = track.id === serialized.selectedDemo;
                  return (
                    <div
                      key={track.id || idx}
                      className={`rounded-xl border p-4 ${isSelected ? "border-brand-400 bg-brand-50 dark:border-brand-500/50 dark:bg-brand-500/5" : "border-gray-200 dark:border-gray-700"}`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-800 dark:text-white/90">
                          {track.title || `Version ${idx + 1}`}
                        </p>
                        {isSelected && (
                          <span className="rounded-full bg-brand-500 px-2 py-0.5 text-xs font-bold text-white">Selected</span>
                        )}
                      </div>
                      {track.imageUrl && (
                        <img src={track.imageUrl} alt={track.title} className="mb-3 h-32 w-full rounded-lg object-cover" />
                      )}
                      {audioUrl && (
                        <div className="flex flex-col gap-2 mt-3">
                          <audio controls src={audioUrl} className="w-full h-10" />
                          <ForceDownloadButton
                            url={audioUrl}
                            filename={`${track.title || "music"}.mp3`}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-50 py-2 text-xs font-semibold text-brand-500 transition hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-400 dark:hover:bg-brand-500/20"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Download this track
                          </ForceDownloadButton>
                        </div>
                      )}
                      {track.duration && (
                        <p className="mt-2 text-center text-xs text-gray-400">
                          Duration: {Math.floor(track.duration / 60)}:{String(Math.floor(track.duration % 60)).padStart(2, "0")} min
                        </p>
                      )}
                      {track.lyrics && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Track Lyrics:</p>
                          <pre className="whitespace-pre-wrap text-xs text-gray-500 dark:text-gray-400 max-h-40 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-800 rounded">{track.lyrics}</pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No tracks generated yet.</p>
            )}
          </div>

          {/* Order Meta */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="mb-3 text-lg font-semibold text-gray-800 dark:text-white/90">Order Meta</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Order ID</span>
                <span className="font-mono text-xs text-gray-600 dark:text-gray-300">{serialized._id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Created</span>
                <span className="text-gray-600 dark:text-gray-300">
                  {new Date(serialized.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              </div>
              {serialized.musicId && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Task ID</span>
                  <span className="font-mono text-xs text-gray-600 dark:text-gray-300 truncate max-w-[120px]">{serialized.musicId}</span>
                </div>
              )}
            </div>
          </div>

          <Link
            href="/all-musics"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.05]"
          >
            ← Back to All Musics
          </Link>
          <DeleteOrderButton orderId={serialized._id} redirectUrl="/all-musics" customerEmail={serialized.email} />
        </div>
      </div>
    </div>
  );
}
