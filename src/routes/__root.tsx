import { QueryClientProvider } from '@tanstack/react-query'
import { createRootRoute, HeadContent, Link, Outlet, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Announcer } from '../components/Announcer'
import { SiteHeader } from '../components/SiteHeader'
import { queryClient } from '../lib/queryClient'
import { announce } from '../stores/announcerStore'

export const Route = createRootRoute({
  head: () => ({ meta: [{ title: 'Quiz Maker' }] }),
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  const router = useRouter()

  // The site-wide page-change rule (CLAUDE.md section 8): when the path changes,
  // move focus to the new page's <h1> and announce it. Changes to search params
  // only (such as q or quiz) are left alone. onRendered fires once the new page is on screen.
  useEffect(() => {
    return router.subscribe('onRendered', (event) => {
      if (!event.fromLocation || !event.pathChanged) return

      const heading = document.querySelector<HTMLElement>('main h1')
      if (!heading) return
      heading.focus()
      announce(heading.textContent ?? '')
    })
  }, [router])

  return (
    <QueryClientProvider client={queryClient}>
      <HeadContent />
      <SiteHeader />
      <Outlet />
      <Announcer />
    </QueryClientProvider>
  )
}

function NotFound() {
  return (
    <main>
      <h1 tabIndex={-1}>Page not found</h1>
      <Link to="/">Go to the home page</Link>
    </main>
  )
}
