// Keeps vercel.json's security headers and index.html in step (change 10, criterion 6).
// The Content-Security-Policy allows the inline settings script in index.html by its hash,
// so any edit to that script must update the hash in vercel.json, or the script stops running.
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import indexHtml from '../../index.html?raw'
import vercelJsonText from '../../vercel.json?raw'

const vercelConfigSchema = z.object({
  rewrites: z.array(z.object({ source: z.string(), destination: z.string() })),
  headers: z.array(
    z.object({
      source: z.string(),
      headers: z.array(z.object({ key: z.string(), value: z.string() })),
    }),
  ),
})

const config = vercelConfigSchema.parse(JSON.parse(vercelJsonText))

function headersFor(source: string) {
  return config.headers.find((rule) => rule.source === source)?.headers ?? []
}

function inlineScript() {
  const match = /<script>([\s\S]*?)<\/script>/.exec(indexHtml)
  if (!match) throw new Error('index.html has no inline <script>')
  return match[1]
}

async function sha256Base64(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
}

describe('security headers in vercel.json', () => {
  it('keeps the rewrite that serves the app for every path', () => {
    expect(config.rewrites).toEqual([{ source: '/(.*)', destination: '/index.html' }])
  })

  it('sends exactly the agreed headers on every path', async () => {
    const scriptHash = await sha256Base64(inlineScript())
    const policy = [
      "default-src 'self'",
      `script-src 'self' 'sha256-${scriptHash}'`,
      "style-src 'self'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self' https://yslyxdjkzbdkxenwfkpy.supabase.co",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ')

    expect(headersFor('/(.*)')).toEqual([
      { key: 'Content-Security-Policy', value: policy },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
      },
    ])
  })

  it('never allows inline or eval scripts', () => {
    const policy = headersFor('/(.*)').find((h) => h.key === 'Content-Security-Policy')?.value
    expect(policy).toBeDefined()
    expect(policy).not.toContain("'unsafe-inline'")
    expect(policy).not.toContain("'unsafe-eval'")
  })

  it('caches built assets long term', () => {
    expect(headersFor('/assets/(.*)')).toEqual([
      { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
    ])
  })

  it('has no other header rules', () => {
    expect(config.headers.map((rule) => rule.source)).toEqual(['/(.*)', '/assets/(.*)'])
  })
})
