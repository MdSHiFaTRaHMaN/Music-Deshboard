import { EcommerceMetrics } from "@/components/ecommerce/EcommerceMetrics";
import React from "react";
import MonthlyTarget from "@/components/ecommerce/MonthlyTarget";
import MonthlySalesChart from "@/components/ecommerce/MonthlySalesChart";
import RecentOrders from "@/components/ecommerce/RecentOrders";
import { getDashboardMetrics } from "@/lib/getDashboardMetrics";

export const metadata = {
  title:
    "Next.js E-commerce Dashboard | TailAdmin - Next.js Dashboard Template",
  description: "This is Next.js Home for TailAdmin Dashboard Template",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Ecommerce() {
  const metrics = await getDashboardMetrics();

  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      {/* Metric Cards - Full Width */}
      <div className="col-span-12">
        <EcommerceMetrics 
          totalCustomers={metrics.totalCustomers} 
          totalOrders={metrics.totalOrders} 
          customersThisMonth={metrics.customersThisMonth}
          customersLastMonth={metrics.customersLastMonth}
          generatedOrdersThisMonth={metrics.generatedOrdersThisMonth}
          generatedOrdersLastMonth={metrics.generatedOrdersLastMonth}
          shopifyTotalOrders={metrics.shopifyTotalOrders}
          shopifyOrdersThisMonth={metrics.shopifyOrdersThisMonth}
          shopifyOrdersLastMonth={metrics.shopifyOrdersLastMonth}
          addedToCartTotal={metrics.addedToCartTotal}
          addedToCartThisMonth={metrics.addedToCartThisMonth}
          addedToCartLastMonth={metrics.addedToCartLastMonth}
        />
      </div>

      {/* Charts Row */}
      <div className="col-span-12 xl:col-span-7">
        <MonthlySalesChart chartData={metrics.chartData} />
      </div>

      <div className="col-span-12 xl:col-span-5">
        <MonthlyTarget 
          revenueThisMonth={metrics.revenueThisMonth}
          revenueLastMonth={metrics.revenueLastMonth}
          revenueToday={metrics.revenueToday}
          monthlyTarget={metrics.monthlyTarget}
        />
      </div>
      <div className="col-span-12 xl:col-span-12">
        <RecentOrders recentOrders={metrics.recentOrders} />
      </div>
    </div>
  );
}
