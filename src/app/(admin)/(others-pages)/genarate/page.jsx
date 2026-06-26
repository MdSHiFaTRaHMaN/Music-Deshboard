"use client";
import React, { useEffect, useState } from "react";
import GenerateForm from "./GenerateForm";
import { ToastProvider } from "@/components/ui/toast/Toast";

export default function GeneratePage() {
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAccess = async () => {
            try {
                // 1. Fetch configured shopUrl from settings
                const res = await fetch("/api/settings");
                const settings = await res.json();
                const shopUrl = settings.shopUrl1?.trim() || "";
                const shopUrl2 = settings.shopUrl2?.trim() || "";
                const shopHost = shopUrl ? new URL(shopUrl).host : "";
                const shopHost2 = shopUrl2 ? new URL(shopUrl2).host : "";

                const currentHost = window.location.host;
                const isLocalhost = currentHost === "https://music-deshboard.onrender.com" || currentHost === "localhost:3000" || currentHost === "127.0.0.1:3000" || currentHost === "localhost:3001" || currentHost === "127.0.0.1:3001";

                // Allow direct access on localhost for development
                if (isLocalhost) {
                    setIsAuthorized(true);
                    return;
                }

                // Check if page is inside an iframe
                const isIframed = window.top !== window.self;

                // 2. Validate Origin/Referrer against configured shop domains
                if (document.referrer && (shopHost || shopHost2)) {
                    try {
                        const refHost = new URL(document.referrer).host;
                        if ((shopHost && refHost === shopHost) || (shopHost2 && refHost === shopHost2)) {
                            setIsAuthorized(true);
                            return;
                        } else {
                            console.warn("Unauthorized iframe origin:", document.referrer);
                            setIsAuthorized(false);
                            return;
                        }
                    } catch (e) {
                        // If URL parsing fails, fall back to string check
                        const referrerLower = document.referrer.toLowerCase();
                        if ((shopUrl && referrerLower.startsWith(shopUrl.toLowerCase())) ||
                            (shopUrl2 && referrerLower.startsWith(shopUrl2.toLowerCase()))) {
                            setIsAuthorized(true);
                            return;
                        } else {
                            setIsAuthorized(false);
                            return;
                        }
                    }
                }

                // 3. Must be inside an iframe if no referrer is explicitly matched
                if (!isIframed) {
                    setIsAuthorized(false);
                    return;
                }

                // Fallback for some browsers that block referrer in iframes
                setIsAuthorized(true);

            } catch (error) {
                console.error("Security check failed:", error);
                setIsAuthorized(false);
            } finally {
                setLoading(false);
            }
        };
        checkAccess();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-8 h-8 border-4 border-brand-500 rounded-full border-t-transparent animate-spin"></div>
            </div>
        );
    }

    if (!isAuthorized) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6">
                <h2 className="text-2xl font-bold text-red-600 mb-2">Unauthorized Access</h2>
                <p className="text-gray-600 dark:text-gray-400">
                    This page can only be accessed from our official Shopify store.
                    Please return to the store to generate your custom music.
                </p>
            </div>
        );
    }

    return (
        <ToastProvider>
            <div className="w-full lg:w-fit my-10 p-5 lg:p-0 m-auto">
                <div className="mb-6 text-center">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white/90 sm:text-2xl">
                        Create Unique Song
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Follow the steps below to customize your music and select your package.
                    </p>
                </div>
                <GenerateForm />
            </div>
        </ToastProvider>
    );
}
