import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill them in from `npx supabase status`.',
  )
}

// Only the anon/publishable key is ever used in the browser.
// PKCE login (change 9): only the /auth/callback route exchanges the code, so the client
// doesn't read the URL itself and no other route sees `code` or `error` search params.
export const supabase = createClient<Database>(url, anonKey, {
  auth: { flowType: 'pkce', detectSessionInUrl: false },
})
