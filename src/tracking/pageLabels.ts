// Route → human-readable label for SocioChat pages.
const LABELS: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/dashboard/workspaces": "Workspaces",
    "/dashboard/hub": "WhatsApp Hub",
    "/dashboard/inbox": "Inbox",
    "/dashboard/conversations": "Conversations",
    "/dashboard/send": "Send Message",
    "/dashboard/bulk": "Bulk Messaging",
    "/dashboard/templates": "Templates",
    "/dashboard/templates/new": "New Template",
    "/dashboard/templates/builder": "Template Builder",
    "/dashboard/automation": "Automation",
    "/dashboard/interactive-automation": "Interactive Flows",
    "/dashboard/drip": "Drip Campaigns",
    "/dashboard/drip-analytics": "Drip Analytics",
    "/dashboard/flows": "Flows",
    "/dashboard/analytics": "Analytics",
    "/dashboard/tracking": "Tracking",
    "/dashboard/contacts": "Contacts",
    "/dashboard/datasets": "Datasets",
    "/dashboard/settings": "Settings",
    "/dashboard/connect": "Connect WhatsApp",
    "/dashboard/guide": "Guide",
    "/dashboard/coexistence": "Coexistence",
    "/dashboard/catalog": "Catalog",
    "/dashboard/orders": "Orders",
    "/dashboard/campaign/create": "Create Campaign",
    "/dashboard/crm": "CRM Dashboard",
    "/dashboard/crm/leads": "CRM Leads",
    "/dashboard/crm/deals": "CRM Deals",
    "/dashboard/crm/contacts": "CRM Contacts",
    "/dashboard/crm/settings": "CRM Settings",
    "/admin/users": "Admin — Users",
    "/admin/user-analytics": "Admin — User Analytics",
    "/admin/page-activity": "Admin — Page Activity",
    "/tenant-admin": "Tenant Admin — Overview",
    "/tenant-admin/users": "Tenant Admin — Users",
    "/tenant-admin/user-analytics": "Tenant Admin — User Analytics",
    "/tenant-admin/page-activity": "Tenant Admin — Page Activity",
    "/pricing": "Pricing",
    "/subscription": "Subscription",
    "/login": "Login",
    "/signup": "Signup",
};

export function getPageLabel(pathname: string): string | undefined {
    if (LABELS[pathname]) return LABELS[pathname];
    // strip trailing IDs and try again
    const stripped = pathname.replace(/\/\d+(?:\/edit)?$/, "");
    return LABELS[stripped];
}
