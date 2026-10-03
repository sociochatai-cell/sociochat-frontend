// SocioChat flow registry — maps the agent's backend flow_keys to SocioChat's
// real builder routes + fillable fields, so the copilot's uiDriver can navigate
// and pre-fill the live forms (prepare-only; never submits). Keyed by the SAME
// flow_keys the agentos router emits (whatsapp_template_builder, crm_lead_create,
// …) so no backend change is needed — SocioChat is the WhatsApp handoff target.
//
// Selectors source-mapped from the SocioChat frontend. Prefer stable `id`
// selectors; `label`/`placeholder` for shadcn/Radix controls without ids.
// Canvas builders (Interactive Automation, Flows v2) are drag-node, so they are
// `handoff` entries: the driver navigates + surfaces guidance instead of filling.

export type SelectorKind = "id" | "name" | "testid" | "placeholder" | "label" | "css";
export type FieldType = "input" | "textarea" | "select" | "combobox" | "radio" | "checkbox" | "date" | "toggle" | "unknown";

export interface FlowField {
  semantic: string; selector: string; selectorKind: SelectorKind; type: FieldType; options?: string[];
  aliases?: string[];
  valueMap?: Record<string, string>;
}
export interface StepRoute {
  route: string;
  fields: string[];
  advanceButtonText?: string | string[];
  nextStepProbe?: { selector: string; selectorKind: SelectorKind };
  terminal?: boolean;
  aiAssist?: { generate: string; apply: string };
  postFill?: { click: string; waitForImage?: boolean; waitForProbe?: { selector: string; selectorKind: SelectorKind }; settleMs?: number };
  navigate?: boolean;
}
export type InteractiveMode = "deepLink" | "sequential";
export interface FlowDef {
  key: string; route: string; title: string; area: string;
  multiStep: boolean; steps: string[]; submitButtons: string[]; fields: FlowField[];
  navigable?: boolean;
  deepLinkableSteps?: boolean;
  stepRoutes?: StepRoute[];
  finalSubmitButtons?: string[];
  interactive?: InteractiveMode;
  openTrigger?: string;
  preClicks?: { text: string; count?: number }[];
  postFill?: { click: string; waitForImage?: boolean; settleMs?: number };
  aiAssist?: { generate: string; apply: string };
  handoff?: string;
}

export const FLOW_REGISTRY: Record<string, FlowDef> = {
  // ── WhatsApp Template Builder ──────────────────────────────────────────────
  whatsapp_template_builder: {
    key: "whatsapp_template_builder",
    route: "/dashboard/templates/new",
    title: "WhatsApp Template Builder",
    area: "whatsapp",
    multiStep: false,
    steps: [],
    submitButtons: ["Submit for Review", "Create Template", "Save"],
    finalSubmitButtons: ["Submit for Review", "Create Template"],
    preClicks: [{ text: "Add Button", count: 0 }],
    fields: [
      { semantic: "name", selector: "name", selectorKind: "id", type: "input", aliases: ["template_name"] },
      { semantic: "category", selector: "Category", selectorKind: "label", type: "combobox",
        options: ["UTILITY", "MARKETING", "AUTHENTICATION"] },
      { semantic: "language", selector: "Language", selectorKind: "label", type: "combobox",
        aliases: ["language_code"] },
      { semantic: "body", selector: "Body", selectorKind: "label", type: "textarea",
        aliases: ["body_text", "message", "content"] },
      { semantic: "header", selector: "Header", selectorKind: "label", type: "input", aliases: ["header_text"] },
      { semantic: "footer", selector: "footer", selectorKind: "id", type: "input", aliases: ["footer_text"] },
    ],
  },

  // ── Bulk / Broadcast Campaign (4-step wizard) ──────────────────────────────
  whatsapp_bulk_campaign_create: {
    key: "whatsapp_bulk_campaign_create",
    route: "/dashboard/bulk",
    title: "Bulk / Broadcast Campaign",
    area: "whatsapp",
    multiStep: true,
    steps: ["setup", "audience", "preview", "schedule"],
    submitButtons: ["Next", "Continue", "Launch", "Schedule"],
    finalSubmitButtons: ["Launch Campaign", "Schedule Campaign", "Launch"],
    interactive: "sequential",
    fields: [
      { semantic: "campaign_name", selector: "Campaign Name", selectorKind: "label", type: "input", aliases: ["name", "campaignName"] },
      { semantic: "campaign_description", selector: "Description", selectorKind: "label", type: "textarea", aliases: ["description", "campaignDescription"] },
      { semantic: "template", selector: "Template", selectorKind: "label", type: "combobox", aliases: ["selectedTemplate", "template_name"] },
    ],
    stepRoutes: [
      { route: "/dashboard/bulk", fields: ["campaign_name", "campaign_description", "template"],
        advanceButtonText: ["Next", "Continue"] },
      { route: "/dashboard/bulk", fields: [], advanceButtonText: ["Next", "Continue"] },
      { route: "/dashboard/bulk", fields: [], advanceButtonText: ["Next", "Continue"] },
      { route: "/dashboard/bulk", fields: [], terminal: true },
    ],
  },

  // ── Drip / Sequence Campaign (create dialog) ───────────────────────────────
  whatsapp_drip_campaign_create: {
    key: "whatsapp_drip_campaign_create",
    route: "/dashboard/drip",
    title: "Drip Campaign",
    area: "whatsapp",
    multiStep: false,
    steps: [],
    submitButtons: ["Create", "Save", "Create Campaign"],
    finalSubmitButtons: ["Create Campaign", "Create"],
    openTrigger: "New Campaign",
    fields: [
      { semantic: "name", selector: "Campaign Name", selectorKind: "label", type: "input", aliases: ["campaign_name"] },
      { semantic: "description", selector: "Description", selectorKind: "label", type: "textarea" },
      { semantic: "trigger_type", selector: "Trigger", selectorKind: "label", type: "combobox",
        aliases: ["trigger"] },
    ],
  },

  // ── WhatsApp Automation Rules (settings-style forms) ───────────────────────
  whatsapp_automation_rules: {
    key: "whatsapp_automation_rules",
    route: "/dashboard/automation",
    title: "WhatsApp Automation Rules",
    area: "whatsapp",
    multiStep: false,
    steps: [],
    submitButtons: ["Save", "Save Changes"],
    finalSubmitButtons: ["Save", "Save Changes"],
    fields: [
      { semantic: "welcome_message", selector: "welcome-msg", selectorKind: "id", type: "textarea", aliases: ["welcome", "greeting"] },
      { semantic: "away_message", selector: "away-msg", selectorKind: "id", type: "textarea", aliases: ["away"] },
    ],
  },

  // ── CTWA / Status Ad wizard (5-step) ───────────────────────────────────────
  ctwa_ad_creator_wizard: {
    key: "ctwa_ad_creator_wizard",
    route: "/ctwa/status/create",
    title: "Click-to-WhatsApp / Status Ad",
    area: "ctwa",
    multiStep: true,
    steps: ["type", "budget", "creative", "message", "review"],
    submitButtons: ["Next", "Continue", "Publish"],
    finalSubmitButtons: ["Publish", "Launch Ad"],
    interactive: "sequential",
    fields: [
      { semantic: "name", selector: "Name", selectorKind: "label", type: "input", aliases: ["campaign_name", "ad_name"] },
      { semantic: "daily_budget", selector: "Daily Budget", selectorKind: "label", type: "input", aliases: ["budget", "daily_budget_inr"] },
      { semantic: "primary_text", selector: "Primary Text", selectorKind: "label", type: "textarea", aliases: ["message", "ad_copy"] },
    ],
    stepRoutes: [
      { route: "/ctwa/status/create", fields: ["name"], advanceButtonText: ["Next", "Continue"] },
      { route: "/ctwa/status/create", fields: ["daily_budget"], advanceButtonText: ["Next", "Continue"] },
      { route: "/ctwa/status/create", fields: [], advanceButtonText: ["Next", "Continue"] },
      { route: "/ctwa/status/create", fields: ["primary_text"], advanceButtonText: ["Next", "Continue"] },
      { route: "/ctwa/status/create", fields: [], terminal: true },
    ],
  },

  // ── CTWA Campaign (embedded) — multi-step; needs a connected FB Page first ──
  ctwa_embedded_signup_flow: {
    key: "ctwa_embedded_signup_flow",
    route: "/dashboard/campaign/create",
    title: "CTWA Campaign Creation",
    area: "ctwa",
    multiStep: true,
    steps: ["account", "campaign", "audience", "creative", "message", "review"],
    submitButtons: ["Next", "Continue", "Publish", "Launch"],
    finalSubmitButtons: ["Publish", "Launch Campaign"],
    interactive: "sequential",
    navigable: true,
    handoff: "Opened CTWA campaign creation. Connect/select a Facebook Page first (the Next button unlocks after that); then I can fill the campaign, budget, creative and click-to-WhatsApp message.",
    fields: [
      { semantic: "campaign_name", selector: "Campaign Name", selectorKind: "label", type: "input", aliases: ["name"] },
      { semantic: "campaign_objective", selector: "Objective", selectorKind: "label", type: "combobox", aliases: ["objective"] },
      { semantic: "daily_budget", selector: "Daily Budget", selectorKind: "label", type: "input", aliases: ["budget", "daily_budget_inr"] },
      { semantic: "creative_primary_text", selector: "Primary Text", selectorKind: "label", type: "textarea", aliases: ["primary_text", "ad_copy"] },
      { semantic: "creative_headline", selector: "Headline", selectorKind: "label", type: "input", aliases: ["headline"] },
      { semantic: "ctwa_prefilled_message", selector: "Prefilled Message", selectorKind: "label", type: "textarea", aliases: ["prefilled_message", "welcome_message"] },
    ],
    stepRoutes: [
      { route: "/dashboard/campaign/create", fields: [], advanceButtonText: ["Next", "Continue"] },
      { route: "/dashboard/campaign/create", fields: ["campaign_name", "campaign_objective"], advanceButtonText: ["Next", "Continue"] },
      { route: "/dashboard/campaign/create", fields: ["daily_budget"], advanceButtonText: ["Next", "Continue"] },
      { route: "/dashboard/campaign/create", fields: ["creative_primary_text", "creative_headline"], advanceButtonText: ["Next", "Continue"] },
      { route: "/dashboard/campaign/create", fields: ["ctwa_prefilled_message"], advanceButtonText: ["Next", "Continue"] },
      { route: "/dashboard/campaign/create", fields: [], terminal: true },
    ],
  },

  // ── CRM Lead / Deal / Contact (modal dialogs, stable ids) ──────────────────
  crm_lead_create: {
    key: "crm_lead_create",
    route: "/dashboard/crm/leads",
    title: "Add Lead",
    area: "crm",
    multiStep: false,
    steps: [],
    submitButtons: ["Add Lead", "Create", "Save"],
    finalSubmitButtons: ["Add Lead", "Create Lead"],
    openTrigger: "Add Lead",
    fields: [
      { semantic: "name", selector: "lead-name", selectorKind: "id", type: "input", aliases: ["lead_name", "full_name"] },
      { semantic: "phone", selector: "lead-phone", selectorKind: "id", type: "input", aliases: ["phone_number", "whatsapp"] },
      { semantic: "email", selector: "lead-email", selectorKind: "id", type: "input" },
      { semantic: "status", selector: "Status", selectorKind: "label", type: "combobox" },
    ],
  },
  crm_deal_create: {
    key: "crm_deal_create",
    route: "/dashboard/crm/deals",
    title: "Add Deal",
    area: "crm",
    multiStep: false,
    steps: [],
    submitButtons: ["Add Deal", "Create", "Save"],
    finalSubmitButtons: ["Add Deal", "Create Deal"],
    openTrigger: "Add Deal",
    fields: [
      { semantic: "name", selector: "deal-name", selectorKind: "id", type: "input", aliases: ["deal_name", "title"] },
      { semantic: "company", selector: "deal-company", selectorKind: "id", type: "input" },
      { semantic: "value", selector: "deal-value", selectorKind: "id", type: "input", aliases: ["amount"] },
      { semantic: "stage", selector: "Stage", selectorKind: "label", type: "combobox" },
    ],
  },
  crm_contact_create: {
    key: "crm_contact_create",
    route: "/dashboard/crm/contacts",
    title: "Add Contact",
    area: "crm",
    multiStep: false,
    steps: [],
    submitButtons: ["Add Contact", "Create", "Save"],
    finalSubmitButtons: ["Add Contact", "Create Contact"],
    openTrigger: "Add Contact",
    fields: [
      { semantic: "name", selector: "c-name", selectorKind: "id", type: "input", aliases: ["full_name"] },
      { semantic: "phone", selector: "c-phone", selectorKind: "id", type: "input", aliases: ["phone_number"] },
      { semantic: "email", selector: "c-email", selectorKind: "id", type: "input" },
      { semantic: "company", selector: "c-company", selectorKind: "id", type: "input" },
    ],
  },

  // ── WhatsApp account connection (Meta embedded signup + technical ids) ──────
  whatsapp_account_setup: {
    key: "whatsapp_account_setup",
    route: "/dashboard/whatsapp/setup",
    title: "WhatsApp Account Connection",
    area: "whatsapp",
    multiStep: false,
    steps: [],
    submitButtons: ["Connect", "Save", "Continue"],
    finalSubmitButtons: ["Connect", "Save"],
    navigable: true,
    fields: [
      { semantic: "whatsapp_business_account_id", selector: "Business Account", selectorKind: "label", type: "input", aliases: ["waba_id", "business_account_id"] },
      { semantic: "whatsapp_phone_number_id", selector: "Phone Number", selectorKind: "label", type: "input", aliases: ["phone_number_id"] },
      { semantic: "permanent_access_token", selector: "Access Token", selectorKind: "label", type: "input", aliases: ["access_token", "token"] },
    ],
    handoff: "Opened WhatsApp setup. Connecting an account normally runs through Meta's embedded signup (the “Connect” button) rather than typing ids by hand — use that unless you're pasting known credentials.",
  },

  // ── Canvas builders → navigate-only handoff (drag-node, AI-generate dialog) ──
  whatsapp_interactive_automation: {
    key: "whatsapp_interactive_automation",
    route: "/dashboard/interactive-automation/new",
    title: "Interactive Automation",
    area: "whatsapp",
    multiStep: false,
    steps: [],
    submitButtons: [],
    fields: [],
    navigable: true,
    handoff: "Opened the Interactive Automation builder. This is a visual node canvas — use the “Name” field and the AI Flow Generator to describe the automation, then arrange the nodes.",
  },
  whatsapp_flow_builder_v2: {
    key: "whatsapp_flow_builder_v2",
    route: "/dashboard/flows/new",
    title: "WhatsApp Flows Builder",
    area: "whatsapp",
    multiStep: false,
    steps: [],
    submitButtons: [],
    fields: [],
    navigable: true,
    handoff: "Opened the WhatsApp Flows builder. Flows are built by dragging blocks from the palette — add your screens/components here, then publish.",
  },
};

export const FLOW_KEYS = Object.keys(FLOW_REGISTRY);
