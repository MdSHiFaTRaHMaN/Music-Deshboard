"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";

export default function DeleteOrderButton({ orderId, redirectUrl = "/all-musics", customerEmail = "" }) {
  const router = useRouter();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteModalOpen(false);
        router.push(redirectUrl);
        router.refresh();
      } else {
        alert("Failed to delete order");
      }
    } catch (error) {
      console.error(error);
      alert("Error deleting order");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setDeleteModalOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 py-3 text-sm font-semibold text-red-500 transition hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 mt-3"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
        Delete this order
      </button>

      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} className="max-w-md p-6">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Confirm Deletion</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Are you sure you want to delete the order {customerEmail ? `for ` : ""}<span className="font-semibold">{customerEmail}</span>? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setDeleteModalOpen(false)}
            disabled={isDeleting}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.05]"
          >
            Cancel
          </button>
          <button
            onClick={confirmDelete}
            disabled={isDeleting}
            className="inline-flex items-center justify-center rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </Modal>
    </>
  );
}
