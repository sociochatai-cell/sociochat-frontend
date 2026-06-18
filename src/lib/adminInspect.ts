import { clearAllUserData } from '@/lib/userSession';

const ACTIVE_KEY = 'sv_admin_inspect_active';
const RETURN_KEY = 'sv_admin_inspect_return';

export function beginAdminInspect(returnPath: string) {
    const adminId = localStorage.getItem('sv_admin_id') || sessionStorage.getItem('sv_admin_id');
    sessionStorage.setItem(ACTIVE_KEY, '1');
    sessionStorage.setItem(RETURN_KEY, returnPath);
    if (adminId) {
        localStorage.setItem('sv_admin_id', adminId);
        sessionStorage.setItem('sv_admin_id', adminId);
    }
}

export function isAdminInspectActive(): boolean {
    return sessionStorage.getItem(ACTIVE_KEY) === '1';
}

export function getAdminInspectReturnPath(): string {
    return sessionStorage.getItem(RETURN_KEY) || '/admin/inspect-login';
}

/** Clear impersonated user session but keep admin inspect markers + admin id. */
export function clearUserSessionKeepAdminInspect() {
    const adminId = localStorage.getItem('sv_admin_id') || sessionStorage.getItem('sv_admin_id');
    const returnPath = sessionStorage.getItem(RETURN_KEY);
    const active = sessionStorage.getItem(ACTIVE_KEY);

    clearAllUserData();

    if (adminId) {
        localStorage.setItem('sv_admin_id', adminId);
        sessionStorage.setItem('sv_admin_id', adminId);
    }
    if (returnPath) sessionStorage.setItem(RETURN_KEY, returnPath);
    if (active) sessionStorage.setItem(ACTIVE_KEY, active);
}

export function endAdminInspect() {
    sessionStorage.removeItem(ACTIVE_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    clearAllUserData();
}
