"use client";
import React from "react";
import GenerateForm from "./GenerateForm";
import { ToastProvider } from "@/components/ui/toast/Toast";

export default function GeneratePage() {
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
