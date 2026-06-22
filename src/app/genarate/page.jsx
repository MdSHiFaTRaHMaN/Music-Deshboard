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
                const shopUrl = settings.shopUrl?.toLowerCase().trim() || "";

                const hostname = window.location.hostname;
                const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
                
                // Allow direct visits ONLY on localhost for development
                if (isLocalhost) {
                    setIsAuthorized(true);
                    setLoading(false);
                    return;
                }

                // 2. Prevent direct visits in production
                const isIframed = window.top !== window.self;
                if (!isIframed) {
                    setIsAuthorized(false);
                    setLoading(false);
                    return;
                }

                // 3. Verify parent window origin using document.referrer if available
                // Note: Modern browsers restrict document.referrer to origin only (e.g. https://mystore.myshopify.com/)
                if (document.referrer && shopUrl) {
                    const cleanShopUrl = shopUrl.replace(/\/+$/, ""); // remove trailing slash
                    if (document.referrer.toLowerCase().startsWith(cleanShopUrl)) {
                        setIsAuthorized(true);
                    } else {
                        console.warn("Unauthorized iframe origin:", document.referrer);
                        setIsAuthorized(false);
                    }
                } else {
                    // Fallback: If document.referrer is hidden but it's iframed, we rely on the API origin checks
                    // which might be spoofable, but it's the best we can do if cross-origin referrer is completely blocked.
                    // Usually, document.referrer will at least show the base origin of the parent frame.
                    setIsAuthorized(true); 
                }

            } catch (error) {
                console.error("Security check failed:", error);
                // Fail secure
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
