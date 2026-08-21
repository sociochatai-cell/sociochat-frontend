import AdminPageActivity from "@/pages/admin/AdminPageActivity";

/** Tenant-scoped page-activity view. Uses the shared component with tenant-admin scope. */
export default function TenantPageActivity() {
    return <AdminPageActivity scope="tenant-admin" />;
}
