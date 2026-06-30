/**
 * Global fetch shim — workspace scoping for the WhatsApp backend.
 * =============================================================
 *
 * The dedicated WhatsApp service enforces workspace scoping (STRICT_WORKSPACE_ACCESS on
 * Cloud Run): flow/account-scoped routes return 401 `workspace_id required (X-Workspace-ID
 * header)` unless the request carries a workspace via the `X-Workspace-ID` header OR a
 * `?workspace_id=` query param.
 *
 * Frontend WhatsApp calls are scattered across many modules as raw `fetch(...)`, so there is
 * no single chokepoint to add the param. We patch `window.fetch` ONCE to append
 * `?workspace_id=` (no custom header → no CORS preflight) and send the session cookie for any
 * request whose URL targets `/api/whatsapp` and doesn't already carry workspace context.
 *
 * Strictly scoped: every non-`/api/whatsapp` request passes through untouched. Idempotent.
 */

import { getWorkspaceId } from './workspaceContext';

let installed = false;

export function installWhatsAppWorkspaceShim(): void {
    if (installed) return;
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
    installed = true;

    const originalFetch = window.fetch.bind(window);

    const patched: typeof window.fetch = (input, init) => {
        try {
            const url =
                typeof input === 'string'
                    ? input
                    : input instanceof URL
                        ? input.toString()
                        : input instanceof Request
                            ? input.url
                            : '';

            if (url && url.includes('/api/whatsapp')) {
                let nextInput: RequestInfo | URL = input;

                // Append workspace_id when absent and the URL is rewritable (string/URL inputs).
                if (!/[?&]workspace_id=/.test(url) && (typeof input === 'string' || input instanceof URL)) {
                    const ws = getWorkspaceId();
                    if (ws) {
                        const sep = url.includes('?') ? '&' : '?';
                        nextInput = url + sep + 'workspace_id=' + encodeURIComponent(ws);
                    }
                }

                // Ensure the session cookie rides along (same-tenant authenticated service).
                const nextInit: RequestInit =
                    init && init.credentials ? init : { ...(init || {}), credentials: 'include' };

                return originalFetch(nextInput, nextInit);
            }
        } catch {
            /* fall through to the original fetch on any unexpected input shape */
        }
        return originalFetch(input, init);
    };

    window.fetch = patched;
}
