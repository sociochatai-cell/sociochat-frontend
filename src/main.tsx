import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { PlanProvider } from './contexts/PlanContext'
import { BrandingProvider } from './branding/BrandingContext'
import DomainGate from './domain/DomainGate'
import { installFetchAuth } from './lib/installFetchAuth'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/toaster'
import './index.css'

// Attach the Bearer token to raw /api fetches (fixes 401s on cookie-only calls
// like GET /api/workspaces?user_id=... when auth is token-based). Must run before
// any component fires a request.
installFetchAuth()

/**
 * SSO identity bootstrap (Sociovia → SocioChat).
 * The SSO deep-link (`?sso=1`) lands with only a server-side session COOKIE set —
 * no `sv_user_id`/`sv_user` in the browser. But DashboardLayout's client-side guard
 * requires `sv_user_id`/`sv_token`, so without this the user is bounced to /login.
 * Here we resolve the identity from the authenticated session (cookie) via
 * GET /api/auth/me and seed localStorage BEFORE React renders, so the guard passes
 * and the header shows the right name. Runs only on the SSO landing; tamper-proof
 * because the cookie — not any URL param — is the source of truth.
 */
async function bootstrapSsoIdentity(): Promise<void> {
  try {
    // The ?sso=1 URL param is consumed + stripped by workspaceContext at IMPORT
    // time (which runs before this body), so we cannot read it here. Instead we key
    // off the durable flag it leaves in sessionStorage. workspaceContext also wiped
    // any stale sv_user_id, so this always resolves the CURRENT session's identity.
    if (sessionStorage.getItem('sso_login_pending') !== '1') return
    const { API_BASE_URL } = await import('./config')
    const res = await fetch(`${API_BASE_URL}/api/auth/me`, { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      const u = data?.user
      if (u?.id) {
        localStorage.setItem('sv_user', JSON.stringify(u))
        sessionStorage.setItem('sv_user', JSON.stringify(u))
        localStorage.setItem('sv_user_id', String(u.id))
        if (u.token) {
          localStorage.setItem('sv_token', String(u.token))
          sessionStorage.setItem('sv_token', String(u.token))
        }
      }
    }
  } catch {
    /* ignore — guard will send to /login, same as a genuinely-unauthenticated visit */
  } finally {
    // one-shot: clear so a later refresh of the clean /dashboard URL is a normal load
    try { sessionStorage.removeItem('sso_login_pending') } catch { /* ignore */ }
  }
}

function renderApp(): void {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <BrandingProvider>
          <DomainGate>
            <AuthProvider>
              <PlanProvider>
                <TooltipProvider delayDuration={0}>
                  <App />
                  <Toaster />
                </TooltipProvider>
              </PlanProvider>
            </AuthProvider>
          </DomainGate>
        </BrandingProvider>
      </BrowserRouter>
    </React.StrictMode>,
  )
}

// Resolve SSO identity first (no-op on normal loads), then render.
bootstrapSsoIdentity().finally(renderApp)
