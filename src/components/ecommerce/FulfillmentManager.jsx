"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { useToast } from "../ui/toast/Toast";

export default function FulfillmentManager({ orderId, currentStatus }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const showToast = useToast();

  const isFulfilled = currentStatus === "fulfilled";

  const toggleDropdown = (e) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  const closeDropdown = () => setIsOpen(false);

  const handleFulfill = async () => {
    if (!orderId) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/shopify/fulfill/${orderId}`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok) {
        showToast({ variant: "success", title: "Success", message: "Order marked as fulfilled!" });
        router.refresh();
      } else {
        console.error("Fulfillment Error Details:", data);
        let debugInfo = data.debug_shopify_response ? JSON.stringify(data.debug_shopify_response) : "";
        showToast({ variant: "error", title: "Error", message: (data.error || "Failed to fulfill order.") + " " + debugInfo });
      }
    } catch (error) {
      console.error(error);
      showToast({ variant: "error", title: "Error", message: "An unexpected error occurred." });
    } finally {
      setLoading(false);
    }
  };

  const handleOnHold = () => {
    closeDropdown();
    showToast({ variant: "info", title: "Info", message: "Mark as on hold feature is not implemented yet." });
  };

  if (isFulfilled) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex items-center justify-between border-b border-gray-100 p-4 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <span className="flex h-6 items-center rounded-full bg-success-50 px-2.5 text-xs font-medium text-success-600 dark:bg-success-500/10 dark:text-success-400">
              Fulfilled
            </span>
          </div>
        </div>
        <div className="p-4 text-sm text-gray-500">
          This order has been fully fulfilled.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] mb-6">
      <div className="flex items-center justify-between border-b border-gray-100 p-4 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <span className="flex h-6 items-center rounded-full bg-warning-50 px-2.5 text-xs font-medium text-warning-800 dark:bg-warning-500/10 dark:text-warning-400">
            Unfulfilled
          </span>
        </div>
        <div className="relative">
          <div className="flex items-center rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-900 text-white hover:bg-gray-800">
            <button
              onClick={handleFulfill}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium border-r border-gray-700 transition disabled:opacity-50"
            >
              {loading ? "Fulfilling..." : "Mark as fulfilled"}
            </button>
            <button
              onClick={toggleDropdown}
              disabled={loading}
              className="px-2 py-2 flex items-center justify-center transition disabled:opacity-50"
            >
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          
          <Dropdown
            isOpen={isOpen}
            onClose={closeDropdown}
            className="absolute right-0 mt-2 flex w-48 flex-col rounded-xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark z-10"
          >
            <ul className="flex flex-col gap-1">
              <li>
                <DropdownItem
                  onItemClick={handleOnHold}
                  tag="button"
                  className="flex w-full items-center gap-3 px-3 py-2 font-medium text-gray-700 rounded-lg text-sm hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 text-left"
                >
                  Mark as on hold
                </DropdownItem>
              </li>
            </ul>
          </Dropdown>
        </div>
      </div>
      <div className="p-4 text-sm text-gray-500">
        All items are waiting to be fulfilled.
      </div>
    </div>
  );
}
