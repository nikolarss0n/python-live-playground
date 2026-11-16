import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { applyTheme, preferredTheme } from './theme'
import { hasMacAi, macAiFetch } from './host/macAi'
import { setJevTransport } from './jev/transport'

applyTheme(preferredTheme())
// The macOS app answers AI checks with Apple's on-device model instead of the dev server.
if (hasMacAi()) setJevTransport(macAiFetch())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </StrictMode>,
)
