# Frontend WhatsApp Rebase — Reconciliation Map (Phase 5 blueprint)

SOURCE = `bug_fix-Auto-Inter/frontend/sociovia-launchpad-31/src` (newer WA UI, separate-origin WA API)
TARGET = `sociochat-frontend/src` (multi-tenant shell, same-origin /api, CRM)

Principle: overwrite TARGET's `whatsapp/`, `whatsapp_automation/`, `ctwa/` with SOURCE's, then rewire
SOURCE's separate WA origin → same-origin `/api`, re-add TARGET-only features, hand-merge a few files,
and UPDATE (not replace) the integration glue. Keep the theme/shell untouched.

## KEEPERS — do NOT change
src/index.css, tailwind.config.js (.js!), src/components/ui/* (56), src/branding/*, src/domain/*,
src/crm/*, src/lib/apiClient.ts. Extend (don't replace): src/config.ts, src/config/featureGating.ts.

## 1. THE central rewire — API origin (config.ts)
TARGET config.ts exports only same-origin API_BASE_URL (""), API_ENDPOINT ("/api"). SOURCE code imports
WHATSAPP_API_BASE_URL / WHATSAPP_API_ENDPOINT / WHATSAPP_REST_API_PREFIX / getApiBaseForPath
(~70 files, 200+ refs; WHATSAPP_REST_API_PREFIX alone 140+ uses/45 files).
FIX: add same-origin aliases to TARGET src/config.ts so ported code compiles unchanged:
  export const WHATSAPP_API_BASE_URL = API_BASE_URL;                 // ""
  export const WHATSAPP_API_ENDPOINT = API_ENDPOINT;                  // "/api"
  export const WHATSAPP_REST_API_PREFIX = `${API_BASE_URL}/api/whatsapp`; // "/api/whatsapp"
  export const getApiBaseForPath = () => API_BASE_URL;
Then delete source's separate-origin (:5005 / Cloud Run) + dev-tunnel WA branches.
Hardcoded spots needing manual edit (alias won't cover):
- whatsapp/pages/WhatsAppCoexistence.tsx:126-131 (COEXISTENCE_API_BASE from VITE_*), :159 api-version
- whatsapp/pages/AutomationOverview.tsx:150 (VITE_WHATSAPP_API_BASE||VITE_API_BASE)
- whatsapp/pages/InteractiveAutomation/InteractiveAutomationsList.tsx:67 (dead API_BASE; real calls use prefix)

## 2. Per-folder classification + action
### whatsapp/ (src=147, tgt=135): 128 BOTH, 19 SOURCE-ONLY, 7 TARGET-ONLY
Action: overwrite with SOURCE, then:
 (a) re-add 7 TARGET-ONLY files:
     pages/CoexistenceDashboard.tsx, api/coexistenceApi.ts, components/WhatsAppConnectionGuard.tsx,
     components/NotConnectedPrompt.tsx, pages/InteractiveAutomation/nodes/SetStatusNode.tsx,
     pages/InteractiveAutomation/panels/TemplateSelectPanel.tsx, pages/InteractiveAutomation/components/index.ts
 (b) hand-merge nodes/index.ts + panels/index.ts to register BOTH source (LeadNode/LeadConfigSection)
     and target (SetStatusNode/TemplateSelectPanel) sets.
 (c) hand-merge utils/workspaceContext.ts: source's setWorkspaceId cache-flush (dynamic import
     waPersistentCache → clearWhatsAppCache + resetCachedFetchSession) + target's
     getWorkspaces/setWorkspaces/clearWorkspaces + WS_LIST_KEY='sv_workspaces' + Workspace interface.
 (d) re-add WhatsAppInbox "Add to CRM": import crmApi from '@/crm/api' (was :13), state (:54),
     handleAddToCrm → crmApi.addLeadFromConversation(String(conv.id)) (:313-324), button JSX.
SOURCE-ONLY to bring: pages/{BookingDashboard,BookingSettings,FlowSubmissions,OperationalHealth,
TrustCenter,VerificationCenter}.tsx, IA nodes/LeadNode.tsx + panels/LeadConfigSection.tsx,
components/{FlowResponsesPanel,RestrictionBanner}.tsx, utils/{parseApiResponse(parseWhatsAppJsonResponse),
waFetchShim,accountStatusFetcher,accountStatusPopup,embeddedSignupSession,flowNfmDisplay,messageDisplay,
operationalProfile,waOpsNavVisible}.ts.

### whatsapp_automation/ (22 BOTH, identical list, 11 drifted): overwrite with SOURCE (newer/larger).
 Rewire api/whatsappApi.ts WA-origin via config alias (uses WHATSAPP_REST_API_PREFIX +
 whatsappLinkingRequest L38-61); verify it still imports apiClient where target did.
 TemplateManager.tsx:75 imports WHATSAPP_REST_API_PREFIX (alias covers).

### ctwa/ (7 BOTH, 1 SOURCE-ONLY components/index.ts): overwrite with SOURCE
 (full AttributionBadge 206 lines vs target stub 15). No CRM/origin coupling.

## 3. CRM cross-links (re-wire, don't drop)
- WhatsAppInbox "Add to CRM" = TARGET-ONLY → re-add (see 2d).
- crm-audience: BulkMessaging.tsx (src/pages/, glue not overwritten) /api/whatsapp/bulk/crm-audience;
  DripCampaignsSection.tsx accounts/{id}/crm-audience/{summary,leads,contacts}; WhatsAppDatasets.tsx
  /api/whatsapp/crm/preview — present in both, source versions win (alias-covered).
- src/crm/ is a keeper; only inbox needs the @/crm import re-added.

## 4. Workspace/tenant wiring
- KEEP target src/lib/apiClient.ts (same-origin API_BASE; injects X-User-Id/X-Admin-Id/Authorization/
  X-Workspace-Id; imports getWorkspaceId from @/whatsapp/utils/workspaceContext L4). Do NOT import source's.
- workspaceContext keys identical (sv_whatsapp_workspace_id, fallback sv_selected_workspace_id) → apiClient safe.
- Auth/storage contract identical (sv_token, sv_user, sv_user_id, credentials:'include').
- External importers of overwritten folders (verify exports survive port):
  contexts/AuthContext.tsx:4,9 (getWorkspaceId,setWorkspaceId,setWorkspaces,clearWorkspaceId);
  pages/LoginPage.tsx:6; pages/admin/AdminLayout.tsx:10 + pages/tenant-admin/TenantAdminLayout.tsx:12
  (clearCache ← @/whatsapp/hooks/useDataCache); pages/BulkMessaging.tsx:85-86 (getWorkspaceId,useWhatsAppRealtime);
  pages/WhatsAppDashboard.tsx:55-57,67 (useWhatsAppConnection,NavigationCommandCenter,analytics,getWorkspaceId);
  crm/api.ts:13 (getWorkspaceId); whatsapp/components/ConversationItem.tsx:8 (AttributionBadge ← @/ctwa).

## 5. Integration glue — UPDATE in place (line ranges, TARGET)
- src/App.tsx: lazy WA imports L47-75; WA dashboard routes L150-187 (each wrapped G feature=..; G helper
  L97-99, import L3); ctwa root routes L197-198. Add lazy+route(+feature) for new SOURCE pages
  (BookingDashboard, OperationalHealth, TrustCenter, VerificationCenter, FlowSubmissions, BookingSettings).
  Keep CoexistenceDashboard import → TARGET's page.
- src/layouts/DashboardLayout.tsx: NAV_ITEMS L34-55; feature-gate filter L206-212 (sidebar L261, dock L304).
- src/config/featureGating.ts: FeatureKey L5-25; ROUTE_FEATURE_MAP L30-54. Add keys for new gated pages.

## 6. Rewire checklist
[ ] config.ts: add 4 WA same-origin aliases; remove :5005/CloudRun/dev-tunnel WA branches.
[ ] Fix hardcoded VITE_WHATSAPP_API_BASE fallbacks (AutomationOverview:150, InteractiveAutomationsList:67, WhatsAppCoexistence:126-131).
[ ] Keep TARGET Coexistence (CoexistenceDashboard + coexistenceApi); don't let source WhatsAppCoexistence take /dashboard/coexistence.
[ ] Re-add WhatsAppInbox "Add to CRM".
[ ] Hand-merge workspaceContext.ts (source cache-flush + target list helpers).
[ ] Hand-merge IA nodes/index.ts + panels/index.ts (keep both feature sets).
[ ] Keep target apiClient.ts.
[ ] Ship source-only utils used by ported code (parseApiResponse, waFetchShim, accountStatusFetcher, embeddedSignupSession, waOpsNavVisible...).
[ ] Update App.tsx + DashboardLayout NAV_ITEMS + featureGating for new pages.
[ ] Verify external importers resolve against ported exports.
[ ] Post-port test: workspace switch (no bleed, X-Workspace-Id set), CRM lead-from-conversation, Coexistence, gated routes/nav.
