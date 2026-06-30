// src/pages/tenant-admin/index.ts
// Barrel for the Tenant Admin portal pages + layout.
// Each page/layout is a DEFAULT export in its own file; re-exported here as a
// NAMED export of the same name for convenient route wiring.
export { default as TenantAdminLayout } from './TenantAdminLayout';
export { default as TenantAdminOverview } from './TenantAdminOverview';
export { default as TenantAdminUsers } from './TenantAdminUsers';
export { default as TenantAdminPlan } from './TenantAdminPlan';
export { tenantAdminApi } from './tenantAdminApi';
