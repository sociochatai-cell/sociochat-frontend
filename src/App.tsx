import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';

// New Layouts & Pages
import DashboardLayout from './layouts/DashboardLayout';
import DashboardHome from './pages/DashboardHome';
const SignupPage = lazy(() => import('./pages/SignupPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
import LandingPage from './pages/LandingPage';

/* ── Lazy-loaded WhatsApp pages ── */
// Named exports — need .then() to wrap
const WhatsAppInbox = lazy(() => import('./whatsapp/pages/WhatsAppInbox').then(m => ({ default: m.WhatsAppInbox })));
const WhatsAppSettings = lazy(() => import('./whatsapp/pages/WhatsAppSettings').then(m => ({ default: m.WhatsAppSettings })));
const FlowsList = lazy(() => import('./whatsapp/pages/FlowsList').then(m => ({ default: m.FlowsList })));
const FlowBuilder = lazy(() => import('./whatsapp/pages/FlowBuilder').then(m => ({ default: m.FlowBuilder })));
const FlowBuilderV2 = lazy(() => import('./whatsapp/pages/FlowBuilderV2').then(m => ({ default: m.FlowBuilderV2 })));
const DripCampaignsSection = lazy(() => import('./whatsapp/pages/DripCampaignsSection').then(m => ({ default: m.DripCampaignsSection })));
const WhatsAppSetupPage = lazy(() => import('./whatsapp_automation/pages/WhatsAppSetupPage'));

// Default exports — import directly
const WhatsAppAutomation = lazy(() => import('./whatsapp/pages/WhatsAppAutomation'));
const WhatsAppContacts = lazy(() => import('./whatsapp/pages/WhatsAppContacts'));
const WhatsAppDatasets = lazy(() => import('./whatsapp/pages/WhatsAppDatasets'));
const WhatsAppTestConsole = lazy(() => import('./whatsapp/pages/WhatsAppTestConsole'));
const WhatsAppGuide = lazy(() => import('./whatsapp/pages/WhatsAppGuide'));
const TrackingAnalytics = lazy(() => import('./whatsapp/pages/TrackingAnalytics'));
const DripAnalyticsPage = lazy(() => import('./whatsapp/pages/DripAnalyticsPage'));
const DripOverallAnalyticsPage = lazy(() => import('./whatsapp/pages/DripOverallAnalyticsPage'));

// Template pages — list (TemplateManager) and builder (TemplateBuilderPage)
const TemplateManager = lazy(() => import('./whatsapp_automation/pages/TemplateManager'));
const TemplateBuilderPage = lazy(() => import('./whatsapp/pages/TemplateBuilderPage').then(m => ({ default: m.TemplateBuilderPage ?? m.default })));

// Interactive Automation
const InteractiveAutomation = lazy(() => import('./whatsapp/pages/InteractiveAutomation').then(m => ({ default: m.InteractiveAutomation })));
const InteractiveAutomationsList = lazy(() => import('./whatsapp/pages/InteractiveAutomation/InteractiveAutomationsList'));

// Coexistence Dashboard
const CoexistenceDashboard = lazy(() => import('./whatsapp/pages/CoexistenceDashboard').then(m => ({ default: m.CoexistenceDashboard ?? m.default })));
const BulkMessaging = lazy(() => import('./pages/BulkMessaging'));
const WhatsAppDashboard = lazy(() => import('./pages/WhatsAppDashboard'));
const WhatsAppCatalog = lazy(() => import('./whatsapp/pages/WhatsAppCatalog').then(m => ({ default: m.WhatsAppCatalog ?? m.default })));
const CreateCTWA = lazy(() => import('./whatsapp_automation/pages/CreateCTWA').then(m => ({ default: m.CreateCTWA })));
const ConversationsInbox = lazy(() => import('./whatsapp_automation/pages/ConversationsInbox'));
const AdCreatorWizard = lazy(() => import('./ctwa/pages/AdCreatorWizard'));
const CampaignsListPage = lazy(() => import('./ctwa/pages/CampaignsListPage'));

/* ── Loading fallback ── */
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

/* ── Main App ── */
export default function App() {
  return (
    <Routes>
      {/* Auth / static pages — wrapped in Suspense */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/signup" element={<Suspense fallback={<PageLoader />}><SignupPage /></Suspense>} />
      <Route path="/login" element={<Suspense fallback={<PageLoader />}><LoginPage /></Suspense>} />
      <Route path="/verify-email" element={<Suspense fallback={<PageLoader />}><VerifyEmailPage /></Suspense>} />
      <Route path="/pricing" element={<Suspense fallback={<PageLoader />}><PricingPage /></Suspense>} />
      <Route path="/forgot-password" element={<Suspense fallback={<PageLoader />}><ForgotPasswordPage /></Suspense>} />
      <Route path="/reset-password" element={<Suspense fallback={<PageLoader />}><ResetPasswordPage /></Suspense>} />
      <Route path="/privacy-policy" element={<Suspense fallback={<PageLoader />}><PrivacyPolicy /></Suspense>} />

      {/* Dashboard — layout handles its own Suspense + transitions */}
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<DashboardHome />} />
        <Route path="hub" element={<WhatsAppDashboard />} />

        {/* Inbox & Test Console */}
        <Route path="inbox" element={<WhatsAppInbox />} />
        <Route path="conversations" element={<ConversationsInbox />} />
        <Route path="send" element={<WhatsAppTestConsole />} />
        <Route path="bulk" element={<BulkMessaging />} />
        <Route path="bulk/:id" element={<BulkMessaging />} />

        {/* Templates — List page first, then builder sub-routes */}
        <Route path="templates" element={<TemplateManager />} />
        <Route path="templates/new" element={<TemplateBuilderPage />} />
        <Route path="templates/builder" element={<TemplateBuilderPage />} />
        <Route path="templates/:id/edit" element={<TemplateBuilderPage />} />

        {/* Automation */}
        <Route path="automation" element={<WhatsAppAutomation />} />

        {/* Interactive Automation */}
        <Route path="interactive-automation" element={<InteractiveAutomationsList />} />
        <Route path="interactive-automations" element={<InteractiveAutomationsList />} />
        <Route path="interactive-automation/new" element={<InteractiveAutomation />} />
        <Route path="interactive-automation/:id" element={<InteractiveAutomation />} />

        {/* Drip Campaigns */}
        <Route path="drip" element={<DripCampaignsSection accountId={0} />} />
        <Route path="drip-analytics" element={<DripOverallAnalyticsPage />} />
        <Route path="campaigns/:id/analytics" element={<DripAnalyticsPage />} />

        {/* Flows */}
        <Route path="flows" element={<FlowsList />} />
        <Route path="flows/new" element={<FlowBuilderV2 />} />
        <Route path="flows/builder" element={<FlowBuilder />} />
        <Route path="flows/builder/:id" element={<FlowBuilder />} />
        <Route path="flows/:id" element={<FlowBuilder />} />
        <Route path="flows/:id/edit" element={<FlowBuilderV2 />} />
        <Route path="flows/v2/new" element={<FlowBuilderV2 />} />
        <Route path="flows/v1/new" element={<FlowBuilder />} />

        {/* Analytics (hub) & Tracking */}
        <Route path="analytics" element={<WhatsAppDashboard />} />
        <Route path="tracking" element={<TrackingAnalytics />} />

        {/* Contacts & Datasets */}
        <Route path="contacts" element={<WhatsAppContacts />} />
        <Route path="datasets" element={<WhatsAppDatasets />} />

        {/* Settings & Setup */}
        <Route path="settings" element={<WhatsAppSettings />} />
        <Route path="connect" element={<WhatsAppSetupPage />} />
        <Route path="whatsapp/setup" element={<WhatsAppSetupPage />} />
        <Route path="guide" element={<WhatsAppGuide />} />
        <Route path="whatsapp/guide" element={<WhatsAppGuide />} />

        {/* Coexistence Dashboard */}
        <Route path="coexistence" element={<CoexistenceDashboard />} />

        {/* Catalog & CTWA */}
        <Route path="catalog" element={<WhatsAppCatalog />} />
        <Route path="campaign/create" element={<CreateCTWA />} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>

      {/* CTWA standalone routes */}
      <Route path="/ctwa/create" element={<Suspense fallback={<PageLoader />}><AdCreatorWizard /></Suspense>} />
      <Route path="/ctwa/campaigns" element={<Suspense fallback={<PageLoader />}><CampaignsListPage /></Suspense>} />

      {/* Global Catch All */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

