"use client";
import React, { useState } from "react";

export default function ForceDownloadButton({ url, filename, className, children }) {
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async (e) => {
        e.preventDefault();
        if (isDownloading) return;
        setIsDownloading(true);

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Network response was not ok");
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = blobUrl;
            link.download = filename || "music.mp3";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);
        } catch (err) {
            console.error("Download failed:", err);
            // Fallback: open in new tab if blob download fails due to CORS or network
            const link = document.createElement("a");
            link.href = url;
            link.target = "_blank";
            link.download = filename || "music.mp3";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <a
            href={url}
            onClick={handleDownload}
            className={`${className || ""} ${isDownloading ? "opacity-70 cursor-wait" : ""}`}
            title={`Download ${filename || "music"}`}
        >
            {isDownloading ? (
                <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin inline-block"></span>
                    Downloading...
                </span>
            ) : children}
        </a>
    );
}
