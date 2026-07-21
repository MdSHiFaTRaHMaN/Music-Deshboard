"use client";

import React, { useState, useEffect } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { useToast } from "@/components/ui/toast/Toast";
import { useUser } from "@/context/UserContext";

export default function SettingsPage() {
  const showToast = useToast();
  const { user, loading: userLoading } = useUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("security"); // "security" or "integrations"
  const [initialData, setInitialData] = useState(null);
  const [formData, setFormData] = useState({
    shopifySecretId: "",
    shopifyClientId: "",
    shopifyAdminApiKey: "",
    shopUrl1: "",
    shopUrl2: "",
    sunoApiKey: "",
    notificationEmail: "",
    contactPhone: "",
    klaviyoApiKey: "",
    previewDurationSeconds: 45,
    rateLimitPerMinute: 0,
    rateLimitPerHour: 0,
    rateLimitPerDay: 10,
    rateLimitPerMonth: 0,
    autoBlockEnabled: false,
    autoBlockGenerationCount: 5,
    autoBlockRequiredPurchases: 0,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        const newFormData = {
          shopifySecretId: data.shopifySecretId || "",
          shopifyClientId: data.shopifyClientId || "",
          shopifyAdminApiKey: data.shopifyAdminApiKey || "",
          shopUrl1: data.shopUrl1 || "",
          shopUrl2: data.shopUrl2 || "",
          sunoApiKey: data.sunoApiKey || "",
          notificationEmail: data.notificationEmail || "",
          contactPhone: data.contactPhone || "",
          klaviyoApiKey: data.klaviyoApiKey || "",
          previewDurationSeconds: data.previewDurationSeconds ?? 45,
          rateLimitPerMinute: data.rateLimitPerMinute ?? 0,
          rateLimitPerHour: data.rateLimitPerHour ?? 0,
          rateLimitPerDay: data.rateLimitPerDay ?? 10,
          rateLimitPerMonth: data.rateLimitPerMonth ?? 0,
          autoBlockEnabled: data.autoBlockEnabled ?? false,
          autoBlockGenerationCount: data.autoBlockGenerationCount ?? 5,
          autoBlockRequiredPurchases: data.autoBlockRequiredPurchases ?? 0,
        };
        setFormData(newFormData);
        setInitialData(newFormData);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
      showToast({ variant: "error", title: "Error", message: "Failed to load settings" });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    let value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (e.target.type === 'number') {
      value = value === "" ? 0 : Number(value);
    }
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setInitialData(formData);
        showToast({ variant: "success", title: "Success", message: "Settings updated successfully!" });
      } else {
        const errorData = await res.json();
        showToast({ variant: "error", title: "Error", message: errorData.message || "Failed to update settings" });
      }
    } catch (error) {
      console.error("Error updating settings:", error);
      showToast({ variant: "error", title: "Error", message: "An error occurred while updating settings" });
    } finally {
      setSaving(false);
    }
  };

  if (loading || userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-brand-500 rounded-full border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-center">
        <h1 className="text-6xl font-bold text-gray-800 dark:text-white/90 mb-4">401</h1>
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-2">Unauthorized Access</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          You do not have the required administrator privileges to view or edit platform settings.
        </p>
      </div>
    );
  }

  const isModified = initialData && JSON.stringify(formData) !== JSON.stringify(initialData);

  return (
    <div className="space-y-6">
      <PageBreadcrumb pageTitle="Platform Settings" />

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        <button
          type="button"
          className={`px-4 py-2 font-semibold text-sm transition-colors ${
            activeTab === "security"
              ? "border-b-2 border-brand-500 text-brand-500"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
          onClick={() => setActiveTab("security")}
        >
          Security & Limits
        </button>
        <button
          type="button"
          className={`px-4 py-2 font-semibold text-sm transition-colors ${
            activeTab === "integrations"
              ? "border-b-2 border-brand-500 text-brand-500"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
          onClick={() => setActiveTab("integrations")}
        >
          Integrations & API
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {activeTab === "security" && (
          <div className="space-y-6 animate-fade-in">
            {/* Music Preview Settings */}
            <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6 bg-white dark:bg-white/[0.03]">
              <h4 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">
                Music Preview Settings
              </h4>
              <div className="grid grid-cols-1 gap-6">
                <div className="col-span-1 md:col-span-1">
                  <Label>Preview Duration (Seconds)</Label>
                  <Input
                    type="number"
                    name="previewDurationSeconds"
                    value={formData.previewDurationSeconds}
                    onChange={handleChange}
                    placeholder="e.g. 45"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    The duration of the audio preview generated for users.
                  </p>
                </div>
              </div>
            </div>

            {/* Generation Limits */}
            <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6 bg-white dark:bg-white/[0.03]">
              <h4 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">
                Generation Limits
              </h4>
              <p className="mb-4 text-sm text-gray-500">Set rate limits for music generation per user (0 means unlimited).</p>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-4">
                <div className="col-span-1">
                  <Label>Per Minute</Label>
                  <Input
                    type="number"
                    name="rateLimitPerMinute"
                    value={formData.rateLimitPerMinute}
                    onChange={handleChange}
                    placeholder="0"
                  />
                </div>
                <div className="col-span-1">
                  <Label>Per Hour</Label>
                  <Input
                    type="number"
                    name="rateLimitPerHour"
                    value={formData.rateLimitPerHour}
                    onChange={handleChange}
                    placeholder="0"
                  />
                </div>
                <div className="col-span-1">
                  <Label>Per Day (24h)</Label>
                  <Input
                    type="number"
                    name="rateLimitPerDay"
                    value={formData.rateLimitPerDay}
                    onChange={handleChange}
                    placeholder="10"
                  />
                </div>
                <div className="col-span-1">
                  <Label>Per Month (30d)</Label>
                  <Input
                    type="number"
                    name="rateLimitPerMonth"
                    value={formData.rateLimitPerMonth}
                    onChange={handleChange}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Auto-Block Logic */}
            <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6 bg-white dark:bg-white/[0.03]">
              <h4 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">
                Auto-Block System
              </h4>
              <div className="grid grid-cols-1 gap-6">
                <div className="col-span-1 flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="autoBlockEnabled"
                    name="autoBlockEnabled"
                    checked={formData.autoBlockEnabled}
                    onChange={handleChange}
                    className="w-5 h-5 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                  />
                  <Label htmlFor="autoBlockEnabled" className="mb-0 cursor-pointer">Enable Auto-Block System</Label>
                </div>
                {formData.autoBlockEnabled && (
                  <div className="col-span-1 grid grid-cols-1 gap-6 lg:grid-cols-2 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
                    <div className="col-span-1">
                      <Label>Generation Threshold</Label>
                      <Input
                        type="number"
                        name="autoBlockGenerationCount"
                        value={formData.autoBlockGenerationCount}
                        onChange={handleChange}
                        placeholder="e.g. 5"
                      />
                      <p className="mt-1 text-xs text-gray-500">Block users who generate this many songs...</p>
                    </div>
                    <div className="col-span-1">
                      <Label>Required Purchases</Label>
                      <Input
                        type="number"
                        name="autoBlockRequiredPurchases"
                        value={formData.autoBlockRequiredPurchases}
                        onChange={handleChange}
                        placeholder="e.g. 0"
                      />
                      <p className="mt-1 text-xs text-gray-500">...while having this many (or fewer) purchases.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "integrations" && (
          <div className="space-y-6 animate-fade-in">
            {/* Shopify Integration Settings */}
            <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6 bg-white dark:bg-white/[0.03]">
              <h4 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">
                Shopify Integration
              </h4>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="col-span-1">
                  <Label>Shopify Secret ID</Label>
                  <Input
                    type="password"
                    name="shopifySecretId"
                    value={formData.shopifySecretId}
                    onChange={handleChange}
                    placeholder="Enter Shopify Secret ID"
                  />
                </div>
                <div className="col-span-1">
                  <Label>Shopify Client ID</Label>
                  <Input
                    type="password"
                    name="shopifyClientId"
                    value={formData.shopifyClientId}
                    onChange={handleChange}
                    placeholder="Enter Shopify Client ID"
                  />
                </div>
                <div className="col-span-1 lg:col-span-2">
                  <Label>Shopify Admin API Access Key</Label>
                  <Input
                    type="password"
                    name="shopifyAdminApiKey"
                    value={formData.shopifyAdminApiKey}
                    onChange={handleChange}
                    placeholder="shpat_..."
                  />
                </div>
                <div className="col-span-1 lg:col-span-2">
                  <Label>Shop URL</Label>
                  <Input
                    type="password"
                    name="shopUrl1"
                    value={formData.shopUrl1}
                    onChange={handleChange}
                    placeholder="e.g., https://your-store.myshopify.com"
                  />
                </div>
                <div className="col-span-1 lg:col-span-2">
                  <Label>Host URL</Label>
                  <Input
                    type="password"
                    name="shopUrl2"
                    value={formData.shopUrl2}
                    onChange={handleChange}
                    placeholder="e.g., https://your-domain.com"
                  />
                </div>
              </div>
            </div>

            {/* AI Integration Settings */}
            <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6 bg-white dark:bg-white/[0.03]">
              <h4 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">
                Suno API Settings
              </h4>
              <div className="grid grid-cols-1 gap-6">
                <div className="col-span-1">
                  <Label>Suno API Key</Label>
                  <Input
                    type="password"
                    name="sunoApiKey"
                    value={formData.sunoApiKey}
                    onChange={handleChange}
                    placeholder="Enter Suno API Key"
                  />
                </div>
              </div>
            </div>

            {/* Klaviyo Integration Settings */}
            <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6 bg-white dark:bg-white/[0.03]">
              <h4 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">
                Klaviyo Integration
              </h4>
              <div className="grid grid-cols-1 gap-6">
                <div className="col-span-1">
                  <Label>Klaviyo Private API Key</Label>
                  <Input
                    type="password"
                    name="klaviyoApiKey"
                    value={formData.klaviyoApiKey}
                    onChange={handleChange}
                    placeholder="pk_..."
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => fetchSettings()} disabled={!isModified || saving}>
            Discard Changes
          </Button>
          <Button type="submit" disabled={!isModified || saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>

      </form>
    </div>
  );
}
