import { z } from 'zod'

// Where to put the person back after logging in with Google or GitHub (change 9).
// Logging in sends the tab away and back, so the page they were on and the element to
// refocus are kept in session storage (never in the URL) until the callback route reads them.
const KEY = 'auth:return'

export type AuthReturn = { path: string; focusId?: string }

const authReturnSchema = z.object({
  // Only a path on this site: one leading slash. Browsers read "//evil.example" and
  // "/\evil.example" as another site.
  path: z.string().regex(/^\/(?![/\\])/),
  focusId: z.string().optional(),
})

function parseJson(raw: string | null): unknown {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveAuthReturn(focusId?: string) {
  const value: AuthReturn = { path: window.location.pathname + window.location.search, focusId }
  sessionStorage.setItem(KEY, JSON.stringify(value))
}

export function clearAuthReturn() {
  sessionStorage.removeItem(KEY)
}

// Reads and removes the saved state. Without one, the person goes to the home page.
export function takeAuthReturn(): AuthReturn {
  const raw = sessionStorage.getItem(KEY)
  clearAuthReturn()
  const parsed = authReturnSchema.safeParse(parseJson(raw))
  return parsed.success ? parsed.data : { path: '/' }
}

// The header's auth button: where focus goes after logging in when no other target was given.
export const AUTH_BUTTON_ID = 'site-auth-button'

// What to focus and announce once the callback route has navigated back. The callback sets
// it just before navigating, and the root route's page-change rule takes it in place of its
// usual "focus the <h1> and announce it". In memory only: it never outlives one navigation.
export type LoginArrival = { focusId?: string; message: string }

let arrival: LoginArrival | null = null

export function setLoginArrival(next: LoginArrival) {
  arrival = next
}

export function takeLoginArrival(): LoginArrival | null {
  const taken = arrival
  arrival = null
  return taken
}
