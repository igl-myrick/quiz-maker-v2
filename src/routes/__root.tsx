import { QueryClientProvider } from '@tanstack/react-query'
import { createRootRoute, HeadContent, Link, Outlet, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Announcer } from '../components/Announcer'
import { SiteHeader } from '../components/SiteHeader'
import { AUTH_BUTTON_ID, takeLoginArrival } from '../lib/authReturn'
import { queryClient } from '../lib/queryClient'
import { takeReturnFocus } from '../lib/returnFocus'
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
  // Coming back to a page that recorded what opened something (returnFocus.ts), focus
  // goes back to that element instead.
  useEffect(() => {
    return router.subscribe('onRendered', (event) => {
      // Coming back from logging in (change 9): focus the element the login was started for,
      // or the header's auth button, and announce the outcome instead of the page heading.
      const arrival = takeLoginArrival()
      if (arrival) {
        const target =
          (arrival.focusId && document.getElementById(arrival.focusId)) ||
          document.getElementById(AUTH_BUTTON_ID)
        target?.focus()
        announce(arrival.message)
        return
      }

      if (!event.fromLocation || !event.pathChanged) return

      const heading = document.querySelector<HTMLElement>('main h1')
      const returnTarget = takeReturnFocus(event.toLocation.state.__TSR_key)
      const target = returnTarget ?? heading
      if (!target) return
      target.focus()
      announce(heading?.textContent ?? '')
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
