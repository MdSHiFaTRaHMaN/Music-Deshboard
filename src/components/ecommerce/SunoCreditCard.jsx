import React from "react";
import { getSettings } from "@/lib/getSettings";

export default async function SunoCreditCard() {
  const settings = await getSettings();
  let credits = null;
  let errorMsg = null;

  if (settings.sunoApiKey) {
    try {
      const baseUrl = settings.sunoApiBase || "https://api.sunoapi.org";
      const res = await fetch(`${baseUrl}/api/v1/generate/credit`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${settings.sunoApiKey}`,
          "Content-Type": "application/json"
        },
        next: { revalidate: 60 }
      });
      
      const json = await res.json();
      if (res.ok && json.code === 200) {
        credits = json.data;
      } else {
        errorMsg = json.msg || "Failed to fetch credits";
      }
    } catch (err) {
      errorMsg = "Network error";
    }
  } else {
    errorMsg = "Suno API key not found in Settings";
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 flex flex-col h-full">
      <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
        <svg className="text-gray-800 size-6 dark:text-white/90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      </div>
      <div className="flex items-end justify-between mt-5">
        <div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Suno API Credits
          </span>
          <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
            {credits !== null ? credits.toLocaleString() : "---"}
          </h4>
        </div>
      </div>
      {errorMsg && (
        <p className="mt-3 text-xs text-red-500">{errorMsg}</p>
      )}
    </div>
  );
}
