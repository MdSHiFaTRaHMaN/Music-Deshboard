"use client";
import React, { useState, useMemo } from "react";
import Link from "next/link";
import Badge from "@/components/ui/badge/Badge";

export default function ShopifyOrdersTable({ initialOrders }) {
  const [sortOption, setSortOption] = useState("date_desc");
  const [filterOption, setFilterOption] = useState("all");

  const filteredAndSortedOrders = useMemo(() => {
    let result = [...initialOrders];

    // Filter
    if (filterOption === "fulfilled") {
      result = result.filter(o => o.fulfillment_status === 'fulfilled');
    } else if (filterOption === "unfulfilled") {
      result = result.filter(o => !o.fulfillment_status || o.fulfillment_status === 'unfulfilled' || o.fulfillment_status === 'partial');
    } else if (filterOption === "paid") {
      result = result.filter(o => o.financial_status === 'paid');
    } else if (filterOption === "unpaid") {
      result = result.filter(o => o.financial_status !== 'paid');
    }

    // Sort
    if (sortOption === "date_desc") {
      result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (sortOption === "date_asc") {
      result.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (sortOption === "total_desc") {
      result.sort((a, b) => parseFloat(b.total_price) - parseFloat(a.total_price));
    } else if (sortOption === "total_asc") {
      result.sort((a, b) => parseFloat(a.total_price) - parseFloat(b.total_price));
    }
    return result;
  }, [initialOrders, sortOption, filterOption]);

  return (
    <>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:mb-7">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Order List
        </h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-white/[0.05] dark:bg-white/[0.03] dark:text-white/90 transition-colors"
            value={filterOption}
            onChange={(e) => setFilterOption(e.target.value)}
          >
            <option value="all">All Orders</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="unfulfilled">Unfulfilled</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
          <select
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-white/[0.05] dark:bg-white/[0.03] dark:text-white/90 transition-colors"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
          >
            <option value="date_desc">Sort by Date (Newest)</option>
            <option value="date_asc">Sort by Date (Oldest)</option>
            <option value="total_desc">Sort by Total (Highest)</option>
            <option value="total_asc">Sort by Total (Lowest)</option>
          </select>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="border-b border-gray-100 dark:border-white/[0.05]">
              <tr>
                <th className="px-5 py-3 font-medium text-gray-500 text-sm dark:text-gray-400">Order ID</th>
                <th className="px-5 py-3 font-medium text-gray-500 text-sm dark:text-gray-400">Customer</th>
                <th className="px-5 py-3 font-medium text-gray-500 text-sm dark:text-gray-400">Date</th>
                <th className="px-5 py-3 font-medium text-gray-500 text-sm dark:text-gray-400">Financial Status</th>
                <th className="px-5 py-3 font-medium text-gray-500 text-sm dark:text-gray-400">Fulfillment Status</th>
                <th className="px-5 py-3 font-medium text-gray-500 text-sm dark:text-gray-400">Total</th>
                <th className="px-5 py-3 font-medium text-gray-500 text-sm dark:text-gray-400">Items</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {filteredAndSortedOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                  <td className="px-5 py-4 text-sm font-medium text-gray-800 dark:text-white/90">
                    <Link href={`/orders/${order.id}`} className="text-brand-500 hover:text-brand-600 hover:underline">
                      #{order.order_number}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400">
                    <span className="block font-medium text-gray-800 dark:text-white/90">
                      {order.customer ? `${order.customer.first_name} ${order.customer.last_name}` : 'No Customer'}
                    </span>
                    <span className="text-xs text-gray-500">{order.email}</span>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4 text-sm">
                    <Badge size="sm" color={order.financial_status === 'paid' ? 'success' : order.financial_status === 'pending' ? 'warning' : 'error'}>
                      {order.financial_status || 'unknown'}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-sm">
                    <Badge size="sm" color={order.fulfillment_status === 'fulfilled' ? 'success' : 'warning'}>
                      {order.fulfillment_status || 'unfulfilled'}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-gray-800 dark:text-white/90 whitespace-nowrap">
                    {order.total_price} {order.currency}
                  </td>
                  <td className="px-5 py-4 text-xs text-gray-600 dark:text-gray-400">
                    <ul className="list-disc pl-4 space-y-1">
                      {order.line_items.map((item) => (
                        <li key={item.id}>
                          {item.title} <span className="text-gray-400">x{item.quantity}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
              {filteredAndSortedOrders.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-5 py-8 text-center text-gray-500">
                    No orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
