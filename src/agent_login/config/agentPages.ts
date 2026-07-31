/**
 * Agent page catalog — SocioChat.
 * ===============================
 * Single source of truth (frontend) for what an agent page is: its permission
 * KEY (matches backend agent_auth/config.py), its display label, and the
 * `/agent/*` route it renders at. Drives the sidebar, the dashboard tiles, and
 * the per-page permission guard.
 */

export interface AgentPage {
  key: string;
  label: string;
  category: "General" | "WhatsApp" | "CRM" | "Marketing";
  route: string;        // the /agent/... route this page renders at
  permissionPath: string; // path pattern matched against agent.allowed_paths
}

export const AGENT_PAGES: AgentPage[] = [
  { key: "dashboard", label: "Dashboard", category: "General", route: "/agent", permissionPath: "/dashboard" },

  // WhatsApp
  { key: "whatsapp_inbox", label: "Inbox", category: "WhatsApp", route: "/agent/inbox", permissionPath: "/whatsapp/inbox/*" },
  { key: "whatsapp_templates", label: "Templates", category: "WhatsApp", route: "/agent/templates", permissionPath: "/whatsapp/templates/*" },
  { key: "whatsapp_contacts", label: "Contacts", category: "WhatsApp", route: "/agent/contacts", permissionPath: "/whatsapp/contacts/*" },
  { key: "whatsapp_datasets", label: "Datasets", category: "WhatsApp", route: "/agent/datasets", permissionPath: "/whatsapp/datasets/*" },
  { key: "whatsapp_bulk", label: "Bulk Messaging", category: "WhatsApp", route: "/agent/bulk", permissionPath: "/whatsapp/bulk/*" },
  { key: "whatsapp_automation", label: "Automation", category: "WhatsApp", route: "/agent/automation", permissionPath: "/whatsapp/automation/*" },
  { key: "whatsapp_interactive", label: "Interactive Flows", category: "WhatsApp", route: "/agent/interactive-automation", permissionPath: "/whatsapp/interactive-automation/*" },
  { key: "whatsapp_flows", label: "Flows", category: "WhatsApp", route: "/agent/flows", permissionPath: "/whatsapp/flows/*" },
  { key: "drip_campaigns", label: "Drip Campaigns", category: "WhatsApp", route: "/agent/drip", permissionPath: "/whatsapp/drip/*" },
  { key: "whatsapp_analytics", label: "WhatsApp Analytics", category: "WhatsApp", route: "/agent/analytics", permissionPath: "/whatsapp/analytics/*" },

  // CRM
  { key: "crm_dashboard", label: "CRM Dashboard", category: "CRM", route: "/agent/crm", permissionPath: "/crm/dashboard/*" },
  { key: "crm_leads", label: "Leads", category: "CRM", route: "/agent/crm/leads", permissionPath: "/crm/leads/*" },
  { key: "crm_contacts", label: "CRM Contacts", category: "CRM", route: "/agent/crm/contacts", permissionPath: "/crm/contacts/*" },
  { key: "crm_deals", label: "Deals", category: "CRM", route: "/agent/crm/deals", permissionPath: "/crm/deals/*" },

  // Marketing
  { key: "analytics", label: "Tracking Analytics", category: "Marketing", route: "/agent/tracking", permissionPath: "/analytics/*" },
];

export function getPageByKey(key: string): AgentPage | undefined {
  return AGENT_PAGES.find((p) => p.key === key);
}

export function getVisiblePages(allowedKeys: string[]): AgentPage[] {
  const allowed = new Set(allowedKeys || []);
  return AGENT_PAGES.filter((p) => allowed.has(p.key));
}

/** Match a live pathname against an agent's allowed_paths wildcard patterns. */
export function pathMatchesPattern(pathname: string, pattern: string): boolean {
  const path = pathname.toLowerCase().replace(/\/$/, "");
  const pat = pattern.toLowerCase().replace(/\/$/, "");
  if (path === pat) return true;
  if (pat.endsWith("/*")) {
    const base = pat.slice(0, -2);
    return path === base || path.startsWith(base + "/");
  }
  return false;
}
