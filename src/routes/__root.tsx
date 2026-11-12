import { QueryClientProvider } from '@tanstack/react-query'
import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { queryClient } from '../lib/queryClient'

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  )
}

function NotFound() {
  return (
    <main>
      <h1>Page not found</h1>
      <Link to="/">Go to the home page</Link>
    </main>
  )
}
