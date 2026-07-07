import React from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { getSettings } from "@/lib/getSettings";
import Badge from "@/components/ui/badge/Badge";
import Link from "next/link";
import ShopifyOrdersTable from "@/components/tables/ShopifyOrdersTable";

export const metadata = {
  title: "Orders | Dashboard",
  description: "Shopify Orders List",
};

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const settings = await getSettings();
  let orders = [];
  let errorMsg = null;

  if (!settings.shopUrl1 || !settings.shopifyAdminApiKey) {
    errorMsg = "Shopify integration is not configured. Please add Shop URL and Admin API Key in Settings.";
  } else {
    try {
      let url = settings.shopUrl1;
      if (!url.startsWith('http')) url = `https://${url}`;
      
      const response = await fetch(`${url}/admin/api/2024-04/orders.json?status=any&limit=50`, {
        headers: {
          "X-Shopify-Access-Token": settings.shopifyAdminApiKey,
          "Content-Type": "application/json"
        },
        cache: "no-store"
      });
      
      const text = await response.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch(e) {
        throw new Error("Invalid response from Shopify API");
      }
      
      if (response.ok && data.orders) {
        orders = data.orders;
      } else {
        errorMsg = data.errors ? JSON.stringify(data.errors) : "Failed to fetch orders from Shopify.";
      }
    } catch (err) {
      console.error(err);
      errorMsg = "An error occurred while fetching orders: " + err.message;
    }
  }

  return (
    <div>
      <PageBreadcrumb pageTitle="Shopify Orders" />
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        {errorMsg ? (
          <div className="p-4 rounded bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
            {errorMsg}
          </div>
        ) : (
          <ShopifyOrdersTable initialOrders={orders} />
        )}
      </div>
    </div>
  );
}
