import ComponentCard from "@/components/common/ComponentCard";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import CustomerTable from "@/components/tables/CustomerTable";
import React from "react";
import { GroupIcon } from "@/icons";
import { FiMusic, FiShieldOff } from "react-icons/fi";

export const metadata = {
  title: "Customer CRM & Security | My Own Music",
  description: "Manage customers and monitor security limits.",
};

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const host = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  let customers = [];
  try {
    // Need to use absolute URL in server components since fetch is executed server-side
    // However, it's easier to just fetch it or we can import the GET method.
    // Given the difficulty with passing cookies properly to absolute URLs in Server Components,
    // we'll fetch from the DB directly in this server component.
  } catch (err) {
    //
  }

  // So let's fetch directly using mongoose
  const dbConnect = (await import("@/lib/mongoose")).default;
  const Order = (await import("@/models/Order")).default;
  const Customer = (await import("@/models/Customer")).default;

  await dbConnect();

  const aggregatedData = await Order.aggregate([
    {
      $group: {
        _id: "$email",
        totalOrders: { $sum: 1 },
        lastOrderDate: { $max: "$createdAt" },
      }
    },
    {
      $sort: { lastOrderDate: -1 }
    }
  ]);

  const customerDocs = await Customer.find({});
  const customerMap = customerDocs.reduce((acc, c) => {
    acc[c.email] = c;
    return acc;
  }, {});

  customers = aggregatedData.map(group => {
    const email = group._id;
    const c = customerMap[email];
    return {
      email: email,
      totalOrders: group.totalOrders,
      lastOrderDate: group.lastOrderDate,
      isBlocked: c ? c.isBlocked : false,
      blockReason: c ? c.blockReason : "",
      securityFlags: c ? c.securityFlags : 0,
      knownIps: c ? c.knownIps : [],
    };
  });

  const serializedCustomers = JSON.parse(JSON.stringify(customers));
  
  const totalBlocked = serializedCustomers.filter(c => c.isBlocked).length;
  const totalGenerations = serializedCustomers.reduce((acc, c) => acc + c.totalOrders, 0);

  return (
    <div>
      <PageBreadcrumb pageTitle="Customer CRM" />
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-6 mb-6">
        {/* Total Customers */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
            <GroupIcon className="text-gray-800 size-6 dark:text-white/90" />
          </div>
          <div className="flex items-end justify-between mt-5">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Total Customers
              </span>
              <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                {serializedCustomers.length.toLocaleString()}
              </h4>
            </div>
          </div>
        </div>

        {/* Blocked Customers */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div className="flex items-center justify-center w-12 h-12 bg-red-50 rounded-xl dark:bg-red-500/10">
            <FiShieldOff className="text-red-500 size-6" />
          </div>
          <div className="flex items-end justify-between mt-5">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Blocked Customers
              </span>
              <h4 className="mt-2 font-bold text-red-600 text-title-sm dark:text-red-400">
                {totalBlocked.toLocaleString()}
              </h4>
            </div>
          </div>
        </div>

        {/* Total Generations */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
            <FiMusic className="text-gray-800 size-6 dark:text-white/90" />
          </div>
          <div className="flex items-end justify-between mt-5">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Total Generations
              </span>
              <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                {totalGenerations.toLocaleString()}
              </h4>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <ComponentCard title="Customer Management">
          <CustomerTable customers={serializedCustomers} />
        </ComponentCard>
      </div>
    </div>
  );
}
