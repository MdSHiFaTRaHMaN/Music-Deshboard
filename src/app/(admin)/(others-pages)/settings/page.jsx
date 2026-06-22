"use client";

import React, { useState, useEffect } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { useToast } from "@/components/ui/toast/Toast";

export default function SettingsPage() {
  const showToast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    shopifySecretId: "",
    shopifyClientId: "",
    shopUrl: "",
    sunoApiKey: "",
    notificationEmail: "",
    contactPhone: "",
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setFormData({
          shopifySecretId: data.shopifySecretId || "",
          shopifyClientId: data.shopifyClientId || "",
          shopUrl: data.shopUrl || "",
          sunoApiKey: data.sunoApiKey || "",
          notificationEmail: data.notificationEmail || "",
          contactPhone: data.contactPhone || "",
        });
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
      showToast({ variant: "error", title: "Error", message: "Failed to load settings" });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-brand-500 rounded-full border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageBreadcrumb pageTitle="Platform Settings" />

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Shopify Integration Settings */}
        <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6 bg-white dark:bg-white/[0.03]">
          <h4 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">
            Shopify Integration
          </h4>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="col-span-1">
              <Label>Shopify Secret ID</Label>
              <Input
                type="text"
                name="shopifySecretId"
                value={formData.shopifySecretId}
                onChange={handleChange}
                placeholder="Enter Shopify Secret ID"
              />
            </div>
            <div className="col-span-1">
              <Label>Shopify Client ID</Label>
              <Input
                type="text"
                name="shopifyClientId"
                value={formData.shopifyClientId}
                onChange={handleChange}
                placeholder="Enter Shopify Client ID"
              />
            </div>
            <div className="col-span-1 lg:col-span-2">
              <Label>Shop URL</Label>
              <Input
                type="text"
                name="shopUrl"
                value={formData.shopUrl}
                onChange={handleChange}
                placeholder="e.g., https://your-store.myshopify.com"
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

        {/* General Settings */}
        <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6 bg-white dark:bg-white/[0.03]">
          <h4 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">
            General Configuration
          </h4>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="col-span-1">
              <Label>Notification Email</Label>
              <Input
                type="email"
                name="notificationEmail"
                value={formData.notificationEmail}
                onChange={handleChange}
                placeholder="admin@example.com"
              />
              <p className="mt-1 text-xs text-gray-500">
                Receive important system and order alerts at this address.
              </p>
            </div>
            <div className="col-span-1">
              <Label>Contact Phone</Label>
              <Input
                type="text"
                name="contactPhone"
                value={formData.contactPhone}
                onChange={handleChange}
                placeholder="+1 234 567 8900"
              />
              <p className="mt-1 text-xs text-gray-500">
                Primary phone number for support/contact purposes.
              </p>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => fetchSettings()}>
            Discard Changes
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>

      </form>
    </div>
  );
}
