/**
 * Dashboard Routes Stub for standalone SocioChat
 * These route helpers are referenced by useBreadcrumbs.
 */

export const DASHBOARD_ROUTES = {
    HOME: '/',
    INBOX: '/inbox',
    TEMPLATES: '/templates',
    AUTOMATION: '/automation',
    ANALYTICS: '/analytics',
    SETTINGS: '/settings',
    CONTACTS: '/contacts',
    FLOWS: '/flows',
    DRIP: '/drip',
    DATASETS: '/datasets',
    TRACKING: '/tracking',
} as const;

export function getRouteLabel(path: string): string {
    const labels: Record<string, string> = {
        '/': 'Dashboard',
        '/inbox': 'Inbox',
        '/templates': 'Templates',
        '/automation': 'Automation',
        '/analytics': 'Analytics',
        '/settings': 'Settings',
        '/contacts': 'Contacts',
        '/flows': 'Flows',
        '/drip': 'Drip Campaigns',
        '/datasets': 'Datasets',
        '/tracking': 'Tracking',
    };
    return labels[path] || path;
}

export default DASHBOARD_ROUTES;
