// delete-account: permanently deletes the calling member's account (feature 5,
// criterion 21; ARCHITECTURE_SPEC.md 7.2). Runs on Supabase Edge Functions (Deno).
//
// It checks the caller's session token first, then deletes their auth user with the
// service role. The foreign keys remove their quizzes, results and settings. It logs
// no email, token or user ID.

import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// Created here from the platform's environment. The key never leaves the function.
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// The member's user ID from a verified session token, or null for anyone else.
async function callerId(request: Request): Promise<string | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!token) return null
  const { data, error } = await admin.auth.getClaims(token)
  const claims = data?.claims
  if (error || !claims || claims.role !== 'authenticated' || typeof claims.sub !== 'string')
    return null
  return claims.sub
}

async function handle(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json(405, { code: 'method_not_allowed' })

  const userId = await callerId(request)
  if (!userId) return json(401, { code: 'unauthorized' })

  const { error } = await admin.auth.admin.deleteUser(userId)
  // Already gone (a retried request, say) counts as success.
  if (error && error.status !== 404) throw new Error('Could not delete the account')

  return new Response(null, { status: 204, headers: corsHeaders })
}

Deno.serve(async (request) => {
  try {
    return await handle(request)
  } catch (error) {
    // Log a short message only: never the request, tokens or IDs.
    console.error(
      'delete-account failed:',
      error instanceof Error ? error.message : 'unknown error',
    )
    return json(500, { code: 'server_error' })
  }
})
