import CreateStaffForm from "@/components/auth/CreateStaffForm";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";

export const metadata = {
  title: "Create Staff | Admin Dashboard",
  description: "Create new user or staff member for the admin dashboard",
};

export default function CreateStaff() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Create Staff" />
      <CreateStaffForm />
    </div>
  );
}
