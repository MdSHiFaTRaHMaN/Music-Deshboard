"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";
import Badge from "../ui/badge/Badge";
import { Modal } from "../ui/modal";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import { useUser } from "@/context/UserContext";
import Pagination from "./Pagination";

export default function UsersTable() {
  const { user, loading: userLoading } = useUser();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState("");

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/auth/users");
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleEditClick = (user) => {
    setEditingUser({ ...user });
    setUpdateError("");
    setIsEditModalOpen(true);
  };

  const handleInputChange = (e) => {
    setEditingUser({ ...editingUser, [e.target.name]: e.target.value });
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    setUpdateLoading(true);
    setUpdateError("");

    try {
      const res = await fetch(`/api/auth/users/${editingUser._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingUser),
      });

      const data = await res.json();
      if (res.ok) {
        // Update user in local state
        setUsers(users.map((u) => (u._id === data.user._id ? data.user : u)));
        setIsEditModalOpen(false);
      } else {
        setUpdateError(data.error || "Failed to update user");
      }
    } catch (err) {
      setUpdateError("An unexpected error occurred");
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return;
    }

    try {
      const res = await fetch(`/api/auth/users/${userId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (res.ok) {
        setUsers(users.filter((u) => u._id !== userId));
      } else {
        alert(data.error || "Failed to delete user");
      }
    } catch (err) {
      alert("An unexpected error occurred while deleting the user");
    }
  };

  if (loading || userLoading) return <div className="p-4 text-center">Loading users...</div>;
  
  if (!user || user.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-center">
        <h1 className="text-6xl font-bold text-gray-800 dark:text-white/90 mb-4">401</h1>
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-2">Unauthorized Access</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          You do not have the required administrator privileges to view or manage staff.
        </p>
      </div>
    );
  }

  if (error) return <div className="p-4 text-center text-red-500">{error}</div>;

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="max-w-full overflow-x-auto">
          <div className="min-w-[1102px]">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                    User
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                    Email
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                    Role
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                    Status
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                    Designation
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-end text-theme-xs dark:text-gray-400">
                    Action
                  </TableCell>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {users.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((user) => (
                  <TableRow key={user._id}>
                    <TableCell className="px-5 py-4 sm:px-6 text-start">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center mr-3 overflow-hidden rounded-full h-11 w-11 shrink-0 bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400 font-bold text-lg">
                          {user?.avatar ? (
                            <Image
                              width={44}
                              height={44}
                              src={user.avatar}
                              alt="User"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            user?.name ? user.name.charAt(0).toUpperCase() : "U"
                          )}
                        </span>
                        <div>
                          <span className="block font-medium text-gray-800 text-theme-sm dark:text-white/90">
                            {user.name}
                          </span>
                          <span className="block text-gray-500 text-theme-xs dark:text-gray-400">
                            {user.phone || "No phone"}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                      {user.email}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                      <span className="capitalize">{user.role}</span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                      <Badge
                        size="sm"
                        color={
                          user.status === "active"
                            ? "success"
                            : user.status === "suspended"
                              ? "error"
                              : "warning"
                        }
                      >
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                      {user.designation || "N/A"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-gray-500 text-end text-theme-sm dark:text-gray-400">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => handleEditClick(user)}
                          className="text-brand-500 hover:text-brand-600 transition-colors"
                        >
                          Edit
                        </button>
                        {user.role !== "admin" && (
                          <button
                            onClick={() => handleDelete(user._id)}
                            className="text-red-500 hover:text-red-600 transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {Math.ceil(users.length / itemsPerPage) > 1 && (
        <div className="flex items-center justify-center p-4 mt-4">
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(users.length / itemsPerPage)}
            onPageChange={(page) => setCurrentPage(page)}
          />
        </div>
      )}

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        className="max-w-md w-full p-6"
      >
        <h3 className="mb-4 text-xl font-semibold text-gray-800 dark:text-white">
          Edit User
        </h3>
        {editingUser && (
          <form onSubmit={handleUpdateSubmit} className="space-y-4">
            {updateError && (
              <div className="p-3 text-sm text-red-500 bg-red-50 rounded-lg">{updateError}</div>
            )}

            <div>
              <Label>Full Name</Label>
              <Input
                name="name"
                value={editingUser.name}
                onChange={handleInputChange}
                required
              />
            </div>

            <div>
              <Label>Email</Label>
              <Input
                type="email"
                name="email"
                value={editingUser.email}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Role</Label>
                <select
                  name="role"
                  value={editingUser.role}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 text-sm text-gray-800 bg-white border border-gray-200 rounded-lg focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-900 dark:border-gray-800 dark:text-white/90"
                  required
                >
                  <option value="admin">Admin</option>
                  <option value="staff">Staff</option>
                </select>
              </div>

              <div>
                <Label>Status</Label>
                <select
                  name="status"
                  value={editingUser.status}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 text-sm text-gray-800 bg-white border border-gray-200 rounded-lg focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-900 dark:border-gray-800 dark:text-white/90"
                  required
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>

            <div>
              <Label>Phone Number</Label>
              <Input
                name="phone"
                value={editingUser.phone}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <Label>Designation</Label>
              <Input
                name="designation"
                value={editingUser.designation}
                onChange={handleInputChange}
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateLoading}>
                {updateLoading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
