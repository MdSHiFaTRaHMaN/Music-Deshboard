"use client";
import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";
import Badge from "../ui/badge/Badge";
import Pagination from "./Pagination";
import { useRouter } from "next/navigation";
import { useToast } from "../ui/toast/Toast";
import { Modal } from "../ui/modal";
import { FiInfo } from "react-icons/fi";

export default function CustomerTable({ customers }) {
  const router = useRouter();
  const toast = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalCustomer, setModalCustomer] = useState(null);
  const [blockReason, setBlockReason] = useState("Your account has been restricted from generating music due to a policy violation.");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const itemsPerPage = 10;

  const filteredCustomers = customers?.filter((c) => {
    // Search query filter
    const q = searchQuery.toLowerCase();
    const matchEmail = c.email.toLowerCase().includes(q);
    const matchIp = c.knownIps?.some(ip => ip.toLowerCase().includes(q));
    const matchSearch = matchEmail || matchIp;
    
    // Status filter
    let matchStatus = true;
    if (filterStatus === "active") matchStatus = !c.isBlocked;
    if (filterStatus === "blocked") matchStatus = c.isBlocked;

    return matchSearch && matchStatus;
  }) || [];

  const totalPages = Math.ceil((filteredCustomers.length || 0) / itemsPerPage);
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  function openBlockModal(customer) {
    if (customer.isBlocked) {
      // If already blocked, just unblock directly without reason
      executeBlockToggle(customer.email, true, "");
    } else {
      // If active, open modal to get reason
      setModalCustomer(customer);
      setBlockReason("Your account has been restricted from generating music due to a policy violation.");
      setIsModalOpen(true);
    }
  }

  async function executeBlockToggle(email, currentStatus, customReason) {
    setIsUpdating(true);
    try {
      const res = await fetch("/api/customers/block", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          isBlocked: !currentStatus,
          blockReason: customReason
        }),
      });
      if (res.ok) {
        setIsModalOpen(false);
        router.refresh();
        toast({
          variant: "success",
          title: "Status Updated",
          message: `${email} has been ${!currentStatus ? 'blocked' : 'unblocked'}.`
        });
      } else {
        toast({
          variant: "error",
          title: "Update Failed",
          message: "Failed to update the customer status."
        });
      }
    } catch (err) {
      toast({
        variant: "error",
        title: "Network Error",
        message: "A network error occurred."
      });
    } finally {
      setIsUpdating(false);
    }
  }

  if (!customers || customers.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        No customers found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
      <div className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-5 border-b border-gray-100 dark:border-white/[0.05] gap-4 sm:gap-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-800 dark:text-white/90 text-theme-md">
            All Customers
          </h3>
          <Badge size="sm" color="light" className="rounded-full px-2">
            {filteredCustomers.length}
          </Badge>
        </div>
        <div className="flex flex-col sm:flex-row items-center w-full sm:w-auto gap-3">
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full sm:w-auto rounded-lg border border-gray-200 bg-transparent px-4 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-800 dark:text-white/90 dark:focus:border-brand-500"
          >
            <option value="all" className="dark:bg-gray-900">All Customers</option>
            <option value="active" className="dark:bg-gray-900">Active Only</option>
            <option value="blocked" className="dark:bg-gray-900">Blocked Only</option>
          </select>
          <input
            type="text"
            placeholder="Search email or IP..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full sm:w-64 rounded-lg border border-gray-200 bg-transparent px-4 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-800 dark:text-white/90 dark:focus:border-brand-500"
          />
        </div>
      </div>

      <div className="max-w-full overflow-x-auto">
        <div className="min-w-[800px]">
          <Table>
            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
              <TableRow>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                  Email
                </TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                  Known IPs
                </TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                  Total Orders
                </TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                  Abuse Flags
                </TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                  Last Active
                </TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                  Status
                </TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400">
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {paginatedCustomers?.map((customer) => (
                <TableRow key={customer.email}>
                  <TableCell className="px-5 py-4 sm:px-6 text-start">
                    <span className="block font-medium text-gray-800 text-theme-sm dark:text-white/90">
                      {customer.email}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-xs dark:text-gray-400 max-w-[150px] truncate">
                    {customer.knownIps && customer.knownIps.length > 0 ? (
                      customer.knownIps.map(ip => (
                        <div key={ip} className="inline-block bg-gray-100 dark:bg-white/[0.05] rounded px-1.5 py-0.5 mr-1 mb-1 text-[10px]">
                          {ip}
                        </div>
                      ))
                    ) : (
                      "N/A"
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                    {customer.totalOrders}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                    {customer.securityFlags > 0 ? (
                      <span className="text-red-500 font-bold">{customer.securityFlags}</span>
                    ) : (
                      "0"
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                    {new Date(customer.lastOrderDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-start">
                    <div className="flex items-center gap-2">
                      <Badge size="sm" color={customer.isBlocked ? "error" : "success"}>
                        {customer.isBlocked ? "Blocked" : "Active"}
                      </Badge>
                      {customer.isBlocked && customer.blockReason && (
                        <div className="relative group flex items-center justify-center">
                          <div className="cursor-help text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                            <FiInfo size={16} />
                          </div>
                          {/* Custom Tooltip */}
                          <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-max max-w-xs -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100 z-50">
                            <div className="rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-xl dark:bg-white dark:text-gray-900 break-words whitespace-normal text-center">
                              {customer.blockReason}
                            </div>
                            {/* Tooltip Arrow */}
                            <div className="absolute top-full left-1/2 -mt-px -ml-1.5 border-[6px] border-transparent border-t-gray-900 dark:border-t-white"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-center">
                    <button
                      disabled={isUpdating}
                      onClick={() => openBlockModal(customer)}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        customer.isBlocked
                          ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-500/10 dark:text-green-400 dark:hover:bg-green-500/20"
                          : "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                      }`}
                    >
                      {customer.isBlocked ? "Unblock" : "Block"}
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center p-4 border-t border-gray-100 dark:border-white/[0.05]">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => setCurrentPage(page)}
          />
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} className="max-w-[500px]">
        <div className="p-6 sm:p-8">
          <h3 className="mb-4 text-xl font-bold text-gray-800 dark:text-white/90">
            Block Customer
          </h3>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Are you sure you want to block <strong>{modalCustomer?.email}</strong>? They will be unable to generate music from any of their known IP addresses.
          </p>
          <div className="mb-5">
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Reason for Blocking (Shown to Customer)
            </label>
            <textarea
              rows="3"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-4 py-3 text-sm text-gray-800 outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:text-white/90 dark:focus:border-brand-500"
              placeholder="Enter the block reason..."
            ></textarea>
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => setIsModalOpen(false)}
              className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
            >
              Cancel
            </button>
            <button
              disabled={isUpdating || !blockReason.trim()}
              onClick={() => executeBlockToggle(modalCustomer.email, false, blockReason)}
              className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isUpdating ? "Blocking..." : "Confirm Block"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
