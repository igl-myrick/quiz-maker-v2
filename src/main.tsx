import 'ply-css/dist/css/ply.min.css'
// Lexend for the dyslexia-friendly font setting, bundled and served from our own domain.
import '@fontsource/lexend/400.css'
import '@fontsource/lexend/700.css'
import './styles/settings.css'
// Applies the saved settings as soon as the app loads (see settingsStore).
import './stores/settingsStore'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { pruneClaimTokens } from './lib/claimTokens'
import { routeTree } from './routeTree.gen'

// Drop claim tokens for anonymous results that have expired (ARCHITECTURE_SPEC.md section 10).
pruneClaimTokens()

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Missing #root element in index.html')
}

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
