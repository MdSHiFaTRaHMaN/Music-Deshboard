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

        {/* General Settings */}
        {/* <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6 bg-white dark:bg-white/[0.03]">
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
        </div> */}

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
