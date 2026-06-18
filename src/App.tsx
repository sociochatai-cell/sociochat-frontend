import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { GatedRoute } from '@/components/feature-gate/GatedRoute';
import RequireAdmin from '@/components/auth/RequireAdmin';

// New Layouts & Pages
import DashboardLayout from './layouts/DashboardLayout';
import DashboardHome from './pages/DashboardHome';
const SignupPage = lazy(() => import('./pages/SignupPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
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
const WhatsAppCatalog = lazy(() => import('./whatsapp/pages/WhatsAppCatalog').then(m => ({ default: m.WhatsAppCatalog ?? m.default })));
const CreateCTWA = lazy(() => import('./whatsapp_automation/pages/CreateCTWA').then(m => ({ default: m.CreateCTWA })));
const ConversationsInbox = lazy(() => import('./whatsapp_automation/pages/ConversationsInbox'));
const AdCreatorWizard = lazy(() => import('./ctwa/pages/AdCreatorWizard'));
const CampaignsListPage = lazy(() => import('./ctwa/pages/CampaignsListPage'));

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

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signup" element={<Suspense fallback={<PageLoader />}><SignupPage /></Suspense>} />
      <Route path="/login" element={<Suspense fallback={<PageLoader />}><LoginPage /></Suspense>} />
      <Route path="/verify-email" element={<Suspense fallback={<PageLoader />}><VerifyEmailPage /></Suspense>} />
      <Route path="/pricing" element={<Suspense fallback={<PageLoader />}><PricingPage /></Suspense>} />
      <Route path="/subscription" element={<Suspense fallback={<PageLoader />}><SubscriptionPage /></Suspense>} />
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
      </Route>

      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<DashboardHome />} />
        <Route path="hub" element={<G feature="unified_dashboard_analytics"><WhatsAppDashboard /></G>} />
        <Route path="inbox" element={<G feature="whatsapp_inbox"><WhatsAppInbox /></G>} />
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
        <Route path="analytics" element={<G feature="whatsapp_analytics"><WhatsAppDashboard /></G>} />
        <Route path="tracking" element={<G feature="whatsapp_tracking"><TrackingAnalytics /></G>} />
        <Route path="contacts" element={<G feature="whatsapp_contacts"><WhatsAppContacts /></G>} />
        <Route path="datasets" element={<G feature="whatsapp_datasets"><WhatsAppDatasets /></G>} />
        <Route path="settings" element={<WhatsAppSettings />} />
        <Route path="connect" element={<WhatsAppSetupPage />} />
        <Route path="whatsapp/setup" element={<WhatsAppSetupPage />} />
        <Route path="guide" element={<WhatsAppGuide />} />
        <Route path="whatsapp/guide" element={<WhatsAppGuide />} />
        <Route path="coexistence" element={<CoexistenceDashboard />} />
        <Route path="catalog" element={<G feature="whatsapp_catalog"><WhatsAppCatalog /></G>} />
        <Route path="campaign/create" element={<G feature="whatsapp_ctwa"><CreateCTWA /></G>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>

      <Route path="/ctwa/create" element={<Suspense fallback={<PageLoader />}><G feature="whatsapp_ctwa"><AdCreatorWizard /></G></Suspense>} />
      <Route path="/ctwa/campaigns" element={<Suspense fallback={<PageLoader />}><G feature="whatsapp_ctwa"><CampaignsListPage /></G></Suspense>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
