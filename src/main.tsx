import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { PlanProvider } from './contexts/PlanContext'
import { BrandingProvider } from './branding/BrandingContext'
import DomainGate from './domain/DomainGate'
import { installFetchAuth } from './lib/installFetchAuth'
import './index.css'

// Attach the Bearer token to raw /api fetches (fixes 401s on cookie-only calls
// like GET /api/workspaces?user_id=... when auth is token-based). Must run before
// any component fires a request.
installFetchAuth()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <BrandingProvider>
        <DomainGate>
          <AuthProvider>
            <PlanProvider>
              <App />
            </PlanProvider>
          </AuthProvider>
        </DomainGate>
      </BrandingProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
