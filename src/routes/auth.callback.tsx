import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { AuthCallbackPage } from '../pages/AuthCallbackPage'

// Where Supabase sends the browser back after Google or GitHub (change 9).
// The provider's error_description is deliberately not read: it's never shown or logged.
const searchSchema = z.object({
  code: z.string().optional(),
  error: z.string().optional(),
})

export const Route = createFileRoute('/auth/callback')({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: 'Logging you in · Quiz Maker' }] }),
  component: AuthCallbackRoute,
})

function AuthCallbackRoute() {
  const { code, error } = Route.useSearch()
  return <AuthCallbackPage code={code} error={error} />
}
