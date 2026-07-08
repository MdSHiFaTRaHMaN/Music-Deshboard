"use client";
import React from "react";
import Badge from "../ui/badge/Badge";
import { ArrowDownIcon, ArrowUpIcon, BoxIconLine, GroupIcon } from "@/icons";
import { FiMusic } from "react-icons/fi";
import { BiPurchaseTag } from "react-icons/bi";

export const EcommerceMetrics = ({ 
  totalCustomers = 0, 
  customersThisMonth = 0,
  customersLastMonth = 0,
  shopifyTotalOrders = 0,
  shopifyOrdersThisMonth = 0,
  shopifyOrdersLastMonth = 0,
  addedToCartTotal = 0,
  addedToCartThisMonth = 0,
  addedToCartLastMonth = 0,
  totalOrders = 0,
  generatedOrdersThisMonth = 0,
  generatedOrdersLastMonth = 0,
  children
}) => {

  const calculateGrowth = (thisMonth, lastMonth) => {
    if (lastMonth > 0) {
      return ((thisMonth - lastMonth) / lastMonth) * 100;
    }
    if (thisMonth > 0) return 100;
    return 0;
  };

  const customerGrowth = calculateGrowth(customersThisMonth, customersLastMonth);
  const shopifyGrowth = calculateGrowth(shopifyOrdersThisMonth, shopifyOrdersLastMonth);
  const cartGrowth = calculateGrowth(addedToCartThisMonth, addedToCartLastMonth);
  const generatedGrowth = calculateGrowth(generatedOrdersThisMonth, generatedOrdersLastMonth);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 md:gap-6">
      {/* <!-- Metric Item Start: Customers --> */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
          <GroupIcon className="text-gray-800 size-6 dark:text-white/90" />
        </div>

        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Customers
            </span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {totalCustomers.toLocaleString()}
            </h4>
          </div>
          <Badge color={customerGrowth >= 0 ? "success" : "error"}>
            {customerGrowth >= 0 ? <ArrowUpIcon /> : <ArrowDownIcon className="text-error-500" />}
            {Math.abs(customerGrowth).toFixed(2)}%
          </Badge>
        </div>
      </div>
      {/* <!-- Metric Item End --> */}

      {/* <!-- Metric Item Start: Shopify Orders --> */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
          <BiPurchaseTag className="text-gray-800 text-2xl dark:text-white/90" />
        </div>
        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Shopify Orders
            </span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {shopifyTotalOrders.toLocaleString()}
            </h4>
          </div>

          <Badge color={shopifyGrowth >= 0 ? "success" : "error"}>
            {shopifyGrowth >= 0 ? <ArrowUpIcon /> : <ArrowDownIcon className="text-error-500" />}
            {Math.abs(shopifyGrowth).toFixed(2)}%
          </Badge>
        </div>
      </div>
      {/* <!-- Metric Item End --> */}

      {/* <!-- Metric Item Start: Added to Cart --> */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
          <BoxIconLine className="text-gray-800 dark:text-white/90" />
        </div>
        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Added to Cart
            </span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {addedToCartTotal.toLocaleString()}
            </h4>
          </div>

          <Badge color={cartGrowth >= 0 ? "success" : "error"}>
            {cartGrowth >= 0 ? <ArrowUpIcon /> : <ArrowDownIcon className="text-error-500" />}
            {Math.abs(cartGrowth).toFixed(2)}%
          </Badge>
        </div>
      </div>
      {/* <!-- Metric Item End --> */}

      {/* <!-- Metric Item Start: Generated Songs --> */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
          <FiMusic className="text-gray-800 size-6 dark:text-white/90" />
        </div>
        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Generated Songs
            </span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {totalOrders.toLocaleString()}
            </h4>
          </div>

          <Badge color={generatedGrowth >= 0 ? "success" : "error"}>
            {generatedGrowth >= 0 ? <ArrowUpIcon /> : <ArrowDownIcon className="text-error-500" />}
            {Math.abs(generatedGrowth).toFixed(2)}%
          </Badge>
        </div>
      </div>
      {/* <!-- Metric Item End --> */}

      {children}
    </div>
  );
};
