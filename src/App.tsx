import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { GatedRoute } from '@/components/feature-gate/GatedRoute';
import RequireAdmin from '@/components/auth/RequireAdmin';
import RequireTenantAdmin from '@/components/auth/RequireTenantAdmin';

// New Layouts & Pages
import DashboardLayout from './layouts/DashboardLayout';
import WorkspacesPage from './pages/WorkspacesPage';
const SignupPage = lazy(() => import('./pages/SignupPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage'));
const PaymentResult = lazy(() => import('./pages/PaymentResult'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
// Local-testing tenant switch: /t/:code sets a tenant override + reloads.
const TenantSwitch = lazy(() => import('./domain/TenantSwitch'));
import LandingPage from './pages/LandingPage';

// Admin
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminInspectLogin = lazy(() => import('./pages/admin/AdminInspectLogin'));
const AdminReview = lazy(() => import('./pages/admin/AdminReview'));
const AdminSubscriptions = lazy(() => import('./pages/admin/AdminSubscriptions'));
const AdminPlans = lazy(() => import('./pages/admin/AdminPlans'));
const AdminPrivateSlot = lazy(() => import('./pages/admin/AdminPrivateSlot'));
const AdminAgents = lazy(() => import('./pages/admin/AdminAgents'));

// Super Admin — Tenant Management (multi-tenant white-label)
const TenantListPage = lazy(() => import('./pages/superadmin/TenantListPage'));
const TenantWizardPage = lazy(() => import('./pages/superadmin/TenantWizardPage'));
const TenantEditPage = lazy(() => import('./pages/superadmin/TenantEditPage'));
const TenantPlansPage = lazy(() => import('./pages/superadmin/TenantPlansPage'));

// Tenant Admin portal — tenant-scoped user management
const TenantAdminLayout = lazy(() => import('./pages/tenant-admin/TenantAdminLayout'));
const TenantAdminOverview = lazy(() => import('./pages/tenant-admin/TenantAdminOverview'));
const TenantAdminUsers = lazy(() => import('./pages/tenant-admin/TenantAdminUsers'));
const TenantAdminPlan = lazy(() => import('./pages/tenant-admin/TenantAdminPlan'));
const TenantAdminSubscription = lazy(() => import('./pages/tenant-admin/TenantAdminSubscription'));
const TenantAdminPrivateSlot = lazy(() => import('./pages/tenant-admin/TenantAdminPrivateSlot'));

import { WhatsAppErrorBoundary } from './whatsapp/components/WhatsAppErrorBoundary';

/* ── Lazy-loaded WhatsApp pages ── */
const WhatsAppInbox = lazy(() => import('./whatsapp/pages/WhatsAppInbox').then(m => ({ default: m.WhatsAppInbox })));
const WhatsAppSettings = lazy(() => import('./whatsapp/pages/WhatsAppSettings').then(m => ({ default: m.WhatsAppSettings })));
const FlowsList = lazy(() => import('./whatsapp/pages/FlowsList').then(m => ({ default: m.FlowsList })));
const FlowBuilder = lazy(() => import('./whatsapp/pages/FlowBuilder').then(m => ({ default: m.FlowBuilder })));
const FlowBuilderV2 = lazy(() => import('./whatsapp/pages/FlowBuilderV2').then(m => ({ default: m.FlowBuilderV2 })));
const DripCampaignsSection = lazy(() => import('./whatsapp/pages/DripCampaignsSection').then(m => ({ default: m.DripCampaignsSection })));
const WhatsAppSetupPage = lazy(() => import('./whatsapp_automation/pages/WhatsAppSetupPage'));
const WhatsAppAutomation = lazy(() => import('./whatsapp/pages/WhatsAppAutomation'));
const WhatsAppContacts = lazy(() => import('./whatsapp/pages/WhatsAppContacts'));
const WhatsAppDatasets = lazy(() => import('./whatsapp/pages/WhatsAppDatasets'));
const WhatsAppTestConsole = lazy(() => import('./whatsapp/pages/WhatsAppTestConsole'));
const WhatsAppGuide = lazy(() => import('./whatsapp/pages/WhatsAppGuide'));
const TrackingAnalytics = lazy(() => import('./whatsapp/pages/TrackingAnalytics'));
const DripAnalyticsPage = lazy(() => import('./whatsapp/pages/DripAnalyticsPage'));
const DripOverallAnalyticsPage = lazy(() => import('./whatsapp/pages/DripOverallAnalyticsPage'));
const TemplateManager = lazy(() => import('./whatsapp_automation/pages/TemplateManager'));
const TemplateBuilderPage = lazy(() => import('./whatsapp/pages/TemplateBuilderPage').then(m => ({ default: m.TemplateBuilderPage ?? m.default })));
const InteractiveAutomation = lazy(() => import('./whatsapp/pages/InteractiveAutomation').then(m => ({ default: m.InteractiveAutomation })));
const InteractiveAutomationsList = lazy(() => import('./whatsapp/pages/InteractiveAutomation/InteractiveAutomationsList'));
const CoexistenceDashboard = lazy(() => import('./whatsapp/pages/CoexistenceDashboard').then(m => ({ default: m.CoexistenceDashboard ?? m.default })));
const BulkMessaging = lazy(() => import('./pages/BulkMessaging'));
const WhatsAppDashboard = lazy(() => import('./pages/WhatsAppDashboard'));
const WhatsAppHub = lazy(() => import('./pages/WhatsAppHub'));
const WhatsAppCatalog = lazy(() => import('./whatsapp/pages/WhatsAppCatalog').then(m => ({ default: m.WhatsAppCatalog ?? m.default })));
const OrdersPage = lazy(() => import('./whatsapp/commerce/OrdersPage'));
const CreateCTWA = lazy(() => import('./whatsapp_automation/pages/CreateCTWA').then(m => ({ default: m.CreateCTWA })));
const ConversationsInbox = lazy(() => import('./whatsapp_automation/pages/ConversationsInbox'));
const StatusAdCreatorWizard = lazy(() => import('./ctwa/pages/StatusAdCreatorWizard'));
const CampaignsListPage = lazy(() => import('./ctwa/pages/CampaignsListPage'));
const CampaignInsightsPage = lazy(() => import('./ctwa/pages/CampaignInsightsPage'));

/* ── Lazy-loaded WhatsApp Flow submissions page ── */
const FlowSubmissions = lazy(() => import('./whatsapp/pages/FlowSubmissions'));

/* ── Lazy-loaded CRM pages ── */
const CRMDashboard = lazy(() => import('./crm/pages/CRMDashboard'));
const CRMLeads = lazy(() => import('./crm/pages/Leads'));
const CRMDeals = lazy(() => import('./crm/pages/Deals'));
const CRMContacts = lazy(() => import('./crm/pages/Contacts'));
const CRMSettings = lazy(() => import('./crm/pages/CRMSettings'));

// Agent (sub-login) portal — distinct from the AI-chat agent_frontend
import { AgentAuthProvider } from './agent_login/contexts/AgentAuthContext';
const AgentLoginPage = lazy(() => import('./agent_login/pages/AgentLoginPage'));
const AgentDashboard = lazy(() => import('./agent_login/pages/AgentDashboard'));
const AgentLayout = lazy(() => import('./agent_login/components/AgentLayout'));
const AgentProtectedRoute = lazy(() => import('./agent_login/components/AgentProtectedRoute'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-4 border-brand-200 animate-pulse" />
          <div className="absolute inset-0 rounded-full border-4 border-t-brand-500 animate-spin" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">Loading...</p>
      </div>
    </div>
  );
}

function G({ feature, children }: { feature: Parameters<typeof GatedRoute>[0]['feature']; children: React.ReactNode }) {
  return <GatedRoute feature={feature}>{children}</GatedRoute>;
}

// Source (Sociovia) pages navigate to /dashboard/whatsapp/<x>, but those routes are
// registered at /dashboard/<x>. Redirect the stray /whatsapp/ variants so create/
// builder buttons land on the right page instead of the catch-all -> /dashboard.
function StripWhatsAppPrefix() {
  const loc = useLocation();
  const to = loc.pathname.replace('/dashboard/whatsapp/', '/dashboard/') + loc.search;
  return <Navigate to={to} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signup" element={<Suspense fallback={<PageLoader />}><SignupPage /></Suspense>} />
      <Route path="/login" element={<Suspense fallback={<PageLoader />}><LoginPage /></Suspense>} />
      {/* Local-testing: switch which tenant the whole app renders as (platform hosts only). */}
      <Route path="/t" element={<Suspense fallback={<PageLoader />}><TenantSwitch /></Suspense>} />
      <Route path="/t/:code" element={<Suspense fallback={<PageLoader />}><TenantSwitch /></Suspense>} />
      <Route path="/verify-email" element={<Suspense fallback={<PageLoader />}><VerifyEmailPage /></Suspense>} />
      <Route path="/pricing" element={<Suspense fallback={<PageLoader />}><PricingPage /></Suspense>} />
      <Route path="/subscription" element={<Suspense fallback={<PageLoader />}><SubscriptionPage /></Suspense>} />
      <Route path="/payment/result" element={<Suspense fallback={<PageLoader />}><PaymentResult /></Suspense>} />
      <Route path="/forgot-password" element={<Suspense fallback={<PageLoader />}><ForgotPasswordPage /></Suspense>} />
      <Route path="/reset-password" element={<Suspense fallback={<PageLoader />}><ResetPasswordPage /></Suspense>} />
      <Route path="/privacy-policy" element={<Suspense fallback={<PageLoader />}><PrivacyPolicy /></Suspense>} />

      {/* Admin portal */}
      <Route path="/admin/login" element={<Suspense fallback={<PageLoader />}><AdminLogin /></Suspense>} />
      <Route path="/admin" element={<RequireAdmin><Suspense fallback={<PageLoader />}><AdminLayout /></Suspense></RequireAdmin>}>
        <Route index element={<Navigate to="/admin/users" replace />} />
        <Route path="users" element={<Suspense fallback={<PageLoader />}><AdminUsers /></Suspense>} />
        <Route path="inspect-login" element={<Suspense fallback={<PageLoader />}><AdminInspectLogin /></Suspense>} />
        <Route path="review" element={<Suspense fallback={<PageLoader />}><AdminReview /></Suspense>} />
        <Route path="subscriptions" element={<Suspense fallback={<PageLoader />}><AdminSubscriptions /></Suspense>} />
        <Route path="plans" element={<Suspense fallback={<PageLoader />}><AdminPlans /></Suspense>} />
        <Route path="private-slot" element={<Suspense fallback={<PageLoader />}><AdminPrivateSlot /></Suspense>} />
        <Route path="agents" element={<Suspense fallback={<PageLoader />}><AdminAgents /></Suspense>} />
      </Route>

      {/* Super Admin — Tenant Management (platform-admin only; rendered inside the admin shell) */}
      <Route path="/superadmin" element={<RequireAdmin><Suspense fallback={<PageLoader />}><AdminLayout /></Suspense></RequireAdmin>}>
        <Route index element={<Navigate to="/superadmin/tenants" replace />} />
        <Route path="tenants" element={<Suspense fallback={<PageLoader />}><TenantListPage /></Suspense>} />
        <Route path="tenants/new" element={<Suspense fallback={<PageLoader />}><TenantWizardPage /></Suspense>} />
        <Route path="tenants/:id" element={<Suspense fallback={<PageLoader />}><TenantEditPage /></Suspense>} />
        <Route path="tenant-plans" element={<Suspense fallback={<PageLoader />}><TenantPlansPage /></Suspense>} />
      </Route>

      {/* Tenant Admin portal — tenant-scoped user management (role: tenant_admin) */}
      <Route path="/tenant-admin" element={<RequireTenantAdmin><Suspense fallback={<PageLoader />}><TenantAdminLayout /></Suspense></RequireTenantAdmin>}>
        <Route index element={<Suspense fallback={<PageLoader />}><TenantAdminOverview /></Suspense>} />
        <Route path="users" element={<Suspense fallback={<PageLoader />}><TenantAdminUsers /></Suspense>} />
        <Route path="plan" element={<Suspense fallback={<PageLoader />}><TenantAdminPlan /></Suspense>} />
        <Route path="subscription" element={<Suspense fallback={<PageLoader />}><TenantAdminSubscription /></Suspense>} />
        <Route path="private-slot" element={<Suspense fallback={<PageLoader />}><TenantAdminPrivateSlot /></Suspense>} />
      </Route>

      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<G feature="unified_dashboard_analytics"><WhatsAppDashboard /></G>} />
        <Route path="workspaces" element={<WorkspacesPage />} />
        <Route path="hub" element={<WhatsAppHub />} />
        <Route path="inbox" element={<G feature="whatsapp_inbox"><WhatsAppErrorBoundary label="Inbox"><WhatsAppInbox /></WhatsAppErrorBoundary></G>} />
        <Route path="conversations" element={<G feature="whatsapp_inbox"><ConversationsInbox /></G>} />
        <Route path="send" element={<WhatsAppTestConsole />} />
        <Route path="bulk" element={<G feature="whatsapp_bulk_messaging"><BulkMessaging /></G>} />
        <Route path="bulk/:id" element={<G feature="whatsapp_bulk_messaging"><BulkMessaging /></G>} />
        <Route path="templates" element={<G feature="whatsapp_templates"><TemplateManager /></G>} />
        <Route path="templates/new" element={<G feature="whatsapp_templates"><TemplateBuilderPage /></G>} />
        <Route path="templates/builder" element={<G feature="whatsapp_templates"><TemplateBuilderPage /></G>} />
        <Route path="templates/:id/edit" element={<G feature="whatsapp_templates"><TemplateBuilderPage /></G>} />
        <Route path="automation" element={<G feature="whatsapp_automation"><WhatsAppAutomation /></G>} />
        <Route path="interactive-automation" element={<G feature="whatsapp_interactive_automation"><InteractiveAutomationsList /></G>} />
        <Route path="interactive-automations" element={<G feature="whatsapp_interactive_automation"><InteractiveAutomationsList /></G>} />
        <Route path="interactive-automation/new" element={<G feature="whatsapp_interactive_automation"><InteractiveAutomation /></G>} />
        <Route path="interactive-automation/:id" element={<G feature="whatsapp_interactive_automation"><InteractiveAutomation /></G>} />
        <Route path="drip" element={<G feature="whatsapp_drip"><DripCampaignsSection accountId={0} /></G>} />
        <Route path="drip-analytics" element={<G feature="whatsapp_drip"><DripOverallAnalyticsPage /></G>} />
        <Route path="campaigns/:id/analytics" element={<G feature="whatsapp_drip"><DripAnalyticsPage /></G>} />
        <Route path="flows" element={<G feature="whatsapp_flows"><FlowsList /></G>} />
        <Route path="flows/new" element={<G feature="whatsapp_flows"><FlowBuilderV2 /></G>} />
        <Route path="flows/builder" element={<G feature="whatsapp_flows"><FlowBuilder /></G>} />
        <Route path="flows/builder/:id" element={<G feature="whatsapp_flows"><FlowBuilder /></G>} />
        <Route path="flows/:id" element={<G feature="whatsapp_flows"><FlowBuilder /></G>} />
        <Route path="flows/:id/edit" element={<G feature="whatsapp_flows"><FlowBuilderV2 /></G>} />
        <Route path="flows/v2/new" element={<G feature="whatsapp_flows"><FlowBuilderV2 /></G>} />
        <Route path="flows/v1/new" element={<G feature="whatsapp_flows"><FlowBuilder /></G>} />
        <Route path="flows/:flowId/submissions" element={<G feature="whatsapp_flows"><FlowSubmissions /></G>} />
        <Route path="analytics" element={<G feature="whatsapp_analytics"><WhatsAppDashboard /></G>} />
        <Route path="tracking" element={<G feature="whatsapp_tracking"><TrackingAnalytics /></G>} />
        <Route path="contacts" element={<G feature="whatsapp_contacts"><WhatsAppContacts /></G>} />
        <Route path="datasets" element={<G feature="whatsapp_datasets"><WhatsAppDatasets /></G>} />
        <Route path="settings" element={<WhatsAppSettings />} />
        <Route path="connect" element={<WhatsAppSetupPage />} />
        <Route path="whatsapp/setup" element={<WhatsAppSetupPage />} />
        <Route path="guide" element={<WhatsAppGuide />} />
        <Route path="whatsapp/guide" element={<WhatsAppGuide />} />
        <Route path="coexistence" element={<G feature="whatsapp_coexistence"><CoexistenceDashboard /></G>} />
        <Route path="catalog" element={<G feature="whatsapp_catalog"><WhatsAppCatalog /></G>} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="campaign/create" element={<G feature="whatsapp_ctwa"><CreateCTWA /></G>} />
        {/* CRM — gated by 'crm' feature key */}
        <Route path="crm" element={<G feature="crm"><CRMDashboard /></G>} />
        <Route path="crm/leads" element={<G feature="crm"><CRMLeads /></G>} />
        <Route path="crm/deals" element={<G feature="crm"><CRMDeals /></G>} />
        <Route path="crm/contacts" element={<G feature="crm"><CRMContacts /></G>} />
        <Route path="crm/settings" element={<G feature="crm"><CRMSettings /></G>} />
        <Route path="whatsapp/*" element={<StripWhatsAppPrefix />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>

      {/* Old separate CTWA screen is retired — the unified wizard handles both
          Status and Click-to-WhatsApp via its "Ad Type" first step. */}
      <Route path="/ctwa/create" element={<Navigate to="/ctwa/status/create" replace />} />
      <Route path="/ctwa/status/create" element={<Suspense fallback={<PageLoader />}><G feature="whatsapp_status_ads"><StatusAdCreatorWizard /></G></Suspense>} />
      <Route path="/ctwa/campaigns" element={<Suspense fallback={<PageLoader />}><G feature="whatsapp_ctwa"><CampaignsListPage /></G></Suspense>} />
      <Route path="/ctwa/campaigns/:id/insights" element={<Suspense fallback={<PageLoader />}><G feature="whatsapp_ctwa"><CampaignInsightsPage /></G></Suspense>} />

      {/* Agent (sub-login) portal. Permissions are enforced by AgentPageGuard
          (frontend) + the agent gate (backend); reused pages authenticate with
          the agent token via the fetch shim. */}
      <Route path="/agent-login" element={<Suspense fallback={<PageLoader />}><AgentAuthProvider><AgentLoginPage /></AgentAuthProvider></Suspense>} />
      <Route path="/agent" element={<Suspense fallback={<PageLoader />}><AgentAuthProvider><AgentProtectedRoute><AgentLayout /></AgentProtectedRoute></AgentAuthProvider></Suspense>}>
        <Route index element={<AgentDashboard />} />
        {/* WhatsApp — reuse existing product pages */}
        <Route path="inbox" element={<WhatsAppErrorBoundary label="Inbox"><WhatsAppInbox /></WhatsAppErrorBoundary>} />
        <Route path="templates" element={<TemplateManager />} />
        <Route path="templates/new" element={<TemplateBuilderPage />} />
        <Route path="templates/:id/edit" element={<TemplateBuilderPage />} />
        <Route path="contacts" element={<WhatsAppContacts />} />
        <Route path="datasets" element={<WhatsAppDatasets />} />
        <Route path="bulk" element={<BulkMessaging />} />
        <Route path="automation" element={<WhatsAppAutomation />} />
        <Route path="interactive-automation" element={<InteractiveAutomationsList />} />
        <Route path="interactive-automation/new" element={<InteractiveAutomation />} />
        <Route path="interactive-automation/:id" element={<InteractiveAutomation />} />
        <Route path="flows" element={<FlowsList />} />
        <Route path="drip" element={<DripCampaignsSection accountId={0} />} />
        <Route path="analytics" element={<WhatsAppDashboard />} />
        <Route path="tracking" element={<TrackingAnalytics />} />
        {/* CRM */}
        <Route path="crm" element={<CRMDashboard />} />
        <Route path="crm/leads" element={<CRMLeads />} />
        <Route path="crm/contacts" element={<CRMContacts />} />
        <Route path="crm/deals" element={<CRMDeals />} />
        <Route path="*" element={<Navigate to="/agent" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
