/**
 * Temporary visibility for Phase 7–9 operational QA links (settings / command center).
 * - Always on in Vite dev.
 * - Staging/prod: append ?wa_qa=1 to any URL, or set localStorage sociovia_wa_ops_nav = "1".
 * - Set VITE_SHOW_WA_OPS_NAV=0 at build time to hide outside dev (optional hard off).
 */
export function isWaOpsQaNavVisible(search: string): boolean {
  if (import.meta.env.VITE_SHOW_WA_OPS_NAV === '0') {
    return false;
  }
  if (import.meta.env.DEV) {
    return true;
  }
  try {
    const q = new URLSearchParams(search || '');
    if (q.get('wa_qa') === '1') {
      return true;
    }
    return typeof localStorage !== 'undefined' && localStorage.getItem('sociovia_wa_ops_nav') === '1';
  } catch {
    return false;
  }
}
