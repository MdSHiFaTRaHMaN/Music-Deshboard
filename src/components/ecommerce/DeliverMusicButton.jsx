"use client";

import React, { useState } from "react";
import { FiSend } from "react-icons/fi";
import { useToast } from "@/components/ui/toast/Toast";

export default function DeliverMusicButton({ order }) {
  const [isSending, setIsSending] = useState(false);
  const showToast = useToast();

  const triggerKlaviyo = async () => {
    const customerEmail = order.email || order.contact_email || order.customer?.email;
    if (!customerEmail) {
      showToast({ variant: "error", title: "Error", message: "No email available to send Klaviyo event." });
      return;
    }

    setIsSending(true);

    try {
      const res = await fetch("/api/klaviyo/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          shopifyOrderId: order.id, 
          email: customerEmail, 
          orderNumber: order.order_number 
        })
      });
      const data = await res.json();

      if (res.ok) {
        showToast({ variant: "success", title: "Success", message: "Music delivered successfully via Klaviyo!" });
      } else {
        showToast({ variant: "error", title: "Error", message: data.error || "Failed to deliver music." });
      }
    } catch (err) {
      showToast({ variant: "error", title: "Error", message: "Network error occurred." });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-brand-200 bg-brand-50 p-6 dark:border-brand-500/20 dark:bg-brand-500/5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-brand-700 dark:text-brand-400">Deliver Music</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Manually trigger Klaviyo to deliver the completed music to the customer.</p>
        </div>
        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <button
            onClick={triggerKlaviyo}
            disabled={isSending}
            className="flex items-center gap-2 rounded-lg bg-[#20BFA9] px-4 py-2 text-sm font-medium text-white hover:bg-[#1CA895] transition disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <FiSend size={16} />
            {isSending ? "Sending..." : "Deliver Music"}
          </button>
        </div>
      </div>
    </div>
  );
}
