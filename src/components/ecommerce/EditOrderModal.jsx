"use client";

import React, { useState } from "react";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { useToast } from "@/components/ui/toast/Toast";
import { useRouter } from "next/navigation";

export default function EditOrderModal({ order, onUpdateSuccess }) {
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    note: order.note || "",
    tags: order.tags || "",
    email: order.email || "",
  });
  const showToast = useToast();
  const router = useRouter();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/shopify/order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          ...formData
        }),
      });

      if (res.ok) {
        showToast({ variant: "success", title: "Success", message: "Order updated successfully" });
        setIsOpen(false);
        router.refresh();
        if (onUpdateSuccess) {
          onUpdateSuccess(); // Optional additional callback
        }
      } else {
        const errorData = await res.json();
        showToast({ variant: "error", title: "Error", message: errorData.error || "Failed to update order" });
      }
    } catch (error) {
      console.error(error);
      showToast({ variant: "error", title: "Error", message: "An error occurred while updating the order." });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)}>
        Edit Order
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg dark:bg-gray-900">
        <h3 className="mb-5 text-xl font-semibold text-gray-800 dark:text-white/90">
          Edit Order #{order.order_number}
        </h3>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <Label>Customer Email</Label>
            <Input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="customer@example.com"
            />
          </div>

          <div>
            <Label>Order Tags (comma separated)</Label>
            <Input
              type="text"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              placeholder="e.g. VIP, urgent"
            />
          </div>

          <div>
            <Label>Order Note</Label>
            <textarea
              name="note"
              value={formData.note}
              onChange={handleChange}
              className="w-full rounded-xl border border-gray-200 bg-transparent px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-gray-800 dark:text-white/90 dark:focus:border-brand-500"
              rows={4}
              placeholder="Add internal note here..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
