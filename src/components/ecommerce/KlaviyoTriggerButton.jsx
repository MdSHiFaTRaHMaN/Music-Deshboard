"use client";

import React, { useState } from "react";
import { FiSend } from "react-icons/fi";

export default function KlaviyoTriggerButton({ shopifyOrderId, email }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // { type: "success" | "error", msg: string }

  const triggerKlaviyo = async () => {
    if (!email) {
      setStatus({ type: "error", msg: "No email available to send Klaviyo event." });
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch("/api/klaviyo/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopifyOrderId, email })
      });
      const data = await res.json();

      if (res.ok) {
        setStatus({ type: "success", msg: data.message || "Successfully sent!" });
      } else {
        setStatus({ type: "error", msg: data.error || "Failed to send." });
      }
    } catch (err) {
      setStatus({ type: "error", msg: "Network error occurred." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
      <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">Klaviyo Automation</h3>
      <p className="text-sm text-gray-500 mb-4">
        Manually trigger the Klaviyo "Music_Delivered" event for this order. This will send the delivery email via your Klaviyo flow.
      </p>

      {status && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${status.type === "success" ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"}`}>
          {status.msg}
        </div>
      )}

      <button
        onClick={triggerKlaviyo}
        disabled={loading}
        className="flex items-center justify-center gap-2 rounded-lg bg-[#20BFA9] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1CA895] disabled:cursor-not-allowed disabled:opacity-70 w-full sm:w-auto"
      >
        <FiSend size={16} />
        {loading ? "Sending Event..." : "Send Event to Klaviyo"}
      </button>
    </div>
  );
}
