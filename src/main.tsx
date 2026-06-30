import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { PlanProvider } from './contexts/PlanContext'
import { BrandingProvider } from './branding/BrandingContext'
import DomainGate from './domain/DomainGate'
import './index.css'

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
