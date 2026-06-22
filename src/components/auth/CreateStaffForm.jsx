"use client";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import ComponentCard from "@/components/common/ComponentCard";
import React, { useState } from "react";

export default function CreateStaffForm() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "staff",
    phone: "",
    designation: ""
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/auth/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess("User created successfully!");
        setFormData({
          name: "",
          email: "",
          password: "",
          role: "staff",
          phone: "",
          designation: ""
        });
      } else {
        setError(data.error || "Failed to create user");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 max-w-[600px] mx-auto">
      <ComponentCard title="Create New User">
        <form onSubmit={handleCreate}>
          <div className="space-y-6">
            {error && <div className="p-3 text-sm text-red-500 bg-red-50 rounded-lg">{error}</div>}
            {success && <div className="p-3 text-sm text-green-500 bg-green-50 rounded-lg">{success}</div>}
            
            <div>
              <Label>
                Full Name <span className="text-error-500">*</span>
              </Label>
              <Input 
                placeholder="John Doe" 
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>
            
            <div>
              <Label>
                Email <span className="text-error-500">*</span>
              </Label>
              <Input 
                placeholder="john@example.com" 
                type="email" 
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
            
            <div>
              <Label>
                Password <span className="text-error-500">*</span>
              </Label>
              <Input
                type="password"
                placeholder="Enter password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <Label>
                Role <span className="text-error-500">*</span>
              </Label>
              <select 
                name="role" 
                value={formData.role} 
                onChange={handleChange}
                className="w-full px-4 py-3 text-sm text-gray-800 bg-white border border-gray-200 rounded-lg focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-900 dark:border-gray-800 dark:text-white/90"
                required
              >
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
                <option value="user">User</option>
              </select>
            </div>

            <div>
              <Label>Phone Number</Label>
              <Input 
                placeholder="+1234567890" 
                type="text" 
                name="phone"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>

            <div>
              <Label>Designation</Label>
              <Input 
                placeholder="e.g. Content Editor" 
                type="text" 
                name="designation"
                value={formData.designation}
                onChange={handleChange}
              />
            </div>

            <div className="pt-2">
              <Button className="w-full" size="sm" disabled={loading}>
                {loading ? "Creating..." : "Create User"}
              </Button>
            </div>
          </div>
        </form>
      </ComponentCard>
    </div>
  );
}
