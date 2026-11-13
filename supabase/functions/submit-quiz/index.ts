// submit-quiz: grades a take and saves its result (feature 1, criterion 16;
// ARCHITECTURE_SPEC.md 7.2). Runs on Supabase Edge Functions (Deno).
//
// Order: identify the caller, apply their rate limit, parse the body, choose the quiz
// version, check the answers, grade, save. Responses are JSON { code, ... } and never
// include stack traces, raw IPs or IP hashes.

import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import { z } from 'npm:zod@4.6.7'
import { corsHeaders } from '../_shared/cors.ts'
import { checkAnswers, gradeQuiz, type QuizSnapshot } from '../_shared/grading.ts'
import { normalizeIp } from '../_shared/ip.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const IP_HASH_SECRET = Deno.env.get('IP_HASH_SECRET') ?? ''
// Local development only: there is no Cloudflare, so trust x-forwarded-for instead.
const TRUST_XFF = Deno.env.get('RATE_LIMIT_TRUST_XFF') === 'true'

const ANON_LIMIT = 30
const MEMBER_LIMIT = 60
const ONE_DAY_MS = 24 * 60 * 60 * 1000

// The project's own public keys. A request carrying one of these is an anonymous visitor.
function projectPublicKeys(): Set<string> {
  const keys = new Set<string>()
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (anonKey) keys.add(anonKey)
  try {
    const publishable: unknown = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}')
    if (publishable && typeof publishable === 'object') {
      for (const value of Object.values(publishable)) if (typeof value === 'string') keys.add(value)
    }
  } catch {
    // No publishable keys configured.
  }
  return keys
}
const PUBLIC_KEYS = projectPublicKeys()

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ---------------------------------------------------------------------------
// Request and snapshot shapes
// ---------------------------------------------------------------------------

const bodySchema = z.object({
  quiz_id: z.uuid(),
  quiz_version: z.number().int().positive(),
  answers: z
    .record(z.uuid(), z.array(z.uuid()).max(8))
    .refine((answers) => Object.keys(answers).length <= 50, 'Too many questions'),
  timed: z.boolean(),
  started_at: z.iso.datetime({ offset: true }).nullable(),
})

const snapshotSchema = z.object({
  snapshot_version: z.literal(1),
  quiz: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    kind: z.enum(['trivia', 'personality']),
    version: z.number(),
    suggested_time_seconds: z.number().nullable(),
  }),
  outcomes: z.array(z.object({ id: z.string(), title: z.string(), description: z.string() })),
  questions: z.array(
    z.object({
      id: z.string(),
      position: z.number(),
      type: z.enum(['single_choice', 'true_false', 'multi_select']),
      prompt: z.string(),
      options: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          is_correct: z.boolean().optional(),
          outcome_id: z.string().optional(),
          points: z.number().optional(),
        }),
      ),
    }),
  ),
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

// A salted (HMAC-SHA-256) hash of the visitor's normalised IP. The raw IP is never stored.
async function hashIp(ip: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(IP_HASH_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ip)))
}

// cf-connecting-ip is set (and overwritten) by Cloudflare in front of Supabase.
// x-forwarded-for can contain client-supplied values, so it is only used locally.
function clientIp(request: Request): string | null {
  const cloudflare = request.headers.get('cf-connecting-ip')
  if (cloudflare) return normalizeIp(cloudflare)
  if (TRUST_XFF) {
    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]
    if (forwarded) return normalizeIp(forwarded)
  }
  return null
}

// A random claim token for anonymous results, and the hash stored in the database.
// The hash matches claim_result: lowercase hex SHA-256 of the token's UTF-8 bytes.
async function newClaimToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const token = btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
  const hash = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))
  return { token, hash }
}

// A random number in [0, 1) for breaking personality ties.
function secureRandom() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32
}

type Caller = { kind: 'member'; userId: string } | { kind: 'anonymous' }

// Members send their session token. Anonymous visitors send the project's public key.
// Anything else (an expired or forged token, say) is rejected.
async function identifyCaller(request: Request): Promise<Caller | null> {
  const token =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    request.headers.get('apikey') ??
    ''
  if (PUBLIC_KEYS.has(token)) return { kind: 'anonymous' }
  if (!token) return null

  const { data, error } = await admin.auth.getClaims(token)
  const claims = data?.claims
  if (error || !claims || claims.role !== 'authenticated' || typeof claims.sub !== 'string')
    return null
  return { kind: 'member', userId: claims.sub }
}

// ---------------------------------------------------------------------------
// The handler
// ---------------------------------------------------------------------------

async function handle(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json(405, { code: 'method_not_allowed' })

  // 1. Who is calling?
  const caller = await identifyCaller(request)
  if (!caller) return json(401, { code: 'unauthorized' })

  // 2. Their rate limit, counted before anything else (a malformed body still counts).
  let scope: 'anon_submit' | 'member_submit'
  let subject: string
  let limit: number
  if (caller.kind === 'member') {
    scope = 'member_submit'
    subject = caller.userId
    limit = MEMBER_LIMIT
  } else {
    const ip = clientIp(request)
    if (!ip) return json(400, { code: 'no_client_ip' })
    if (!IP_HASH_SECRET) throw new Error('IP_HASH_SECRET is not set')
    scope = 'anon_submit'
    subject = await hashIp(ip)
    limit = ANON_LIMIT
  }
  const { data: allowed, error: limitError } = await admin.rpc('hit_rate_limit', {
    p_scope: scope,
    p_subject: subject,
    p_max: limit,
    p_window: '1 hour',
  })
  if (limitError) throw new Error('Rate limit check failed')
  if (allowed !== true) return json(429, { code: 'rate_limited' })

  // 3. The submission.
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return json(400, { code: 'invalid_body' })
  }
  const parsed = bodySchema.safeParse(rawBody)
  if (!parsed.success) return json(400, { code: 'invalid_body' })
  const body = parsed.data

  // 4. The version the take started on: the live quiz if it still matches, otherwise the
  //    24-hour retired copy (ADR 0003). Each read is one consistent SQL statement.
  const { data: liveData, error: liveError } = await admin.rpc('quiz_snapshot', {
    p_quiz_id: body.quiz_id,
  })
  if (liveError) throw new Error('Could not load the quiz')
  const live = liveData === null ? null : snapshotSchema.parse(liveData)

  let quiz: QuizSnapshot
  if (live && live.quiz.version === body.quiz_version) {
    quiz = live
  } else {
    const { data: retired, error: retiredError } = await admin
      .from('quiz_versions')
      .select('snapshot')
      .eq('quiz_id', body.quiz_id)
      .eq('version', body.quiz_version)
      .maybeSingle()
    if (retiredError) throw new Error('Could not load the retired version')
    if (retired) quiz = snapshotSchema.parse(retired.snapshot)
    else if (live) return json(409, { code: 'quiz_changed' })
    else return json(410, { code: 'quiz_deleted' })
  }

  // 5. Check and grade.
  const problem = checkAnswers(quiz, body.answers)
  if (problem) return json(422, problem)
  const graded = gradeQuiz(quiz, body.answers, secureRandom)

  // 6. Save the result.
  const now = Date.now()
  const startedAt = body.started_at ? Date.parse(body.started_at) : null
  const durationSeconds =
    body.timed && startedAt !== null
      ? Math.round(Math.min(Math.max(now - startedAt, 0), ONE_DAY_MS) / 1000)
      : null
  const claim = caller.kind === 'anonymous' ? await newClaimToken() : null

  const row = {
    quiz_id: live ? body.quiz_id : null,
    quiz_version: quiz.quiz.version,
    quiz_kind: quiz.quiz.kind,
    quiz_title: quiz.quiz.title,
    snapshot: graded.snapshot,
    score: graded.score,
    outcome_ranking: graded.outcome_ranking,
    timed: body.timed,
    duration_seconds: durationSeconds,
    owner_id: caller.kind === 'member' ? caller.userId : null,
    expires_at: claim ? new Date(now + ONE_DAY_MS).toISOString() : null,
    claim_token_hash: claim?.hash ?? null,
  }

  let insert = await admin.from('results').insert(row).select('id').single()
  // The quiz was deleted a moment ago: save the result without its link to the quiz.
  if (insert.error?.code === '23503') {
    insert = await admin
      .from('results')
      .insert({ ...row, quiz_id: null })
      .select('id')
      .single()
  }
  if (insert.error || !insert.data) throw new Error('Could not save the result')

  return json(200, { result_id: insert.data.id, ...(claim ? { claim_token: claim.token } : {}) })
}

Deno.serve(async (request) => {
  try {
    return await handle(request)
  } catch (error) {
    // Log a short message only: never the request, IPs or tokens.
    console.error('submit-quiz failed:', error instanceof Error ? error.message : 'unknown error')
    return json(500, { code: 'server_error' })
  }
})
