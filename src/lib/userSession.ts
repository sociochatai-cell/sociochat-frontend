/**
 * Clear SocioChat user session keys from storage on logout.
 *
 * Wipes ALL login credentials + per-user cache (so the next user starts clean),
 * but PRESERVES domain/branding keys so the login screen still renders the
 * correct tenant look (the tenant is a property of the domain, not the user).
 */
const PRESERVE_KEYS = new Set<string>([
    'sv_tenant_code',              // domain's tenant (re-derived by DomainGate anyway)
    'sv_brand_vars',              // pre-paint brand CSS vars
    'sv_domain',
    'sv_domain_branding_version',
]);

export function clearAllUserData() {
    const wipe = (store: Storage) => {
        const keys: string[] = [];
        for (let i = 0; i < store.length; i++) {
            const key = store.key(i);
            if (key && (key.startsWith('sv_') || key.startsWith('sociochat_')) && !PRESERVE_KEYS.has(key)) {
                keys.push(key);
            }
        }
        keys.forEach(k => store.removeItem(k));
    };
    wipe(localStorage);
    wipe(sessionStorage);
}
