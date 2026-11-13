import 'ply-css/dist/css/ply.min.css'
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
