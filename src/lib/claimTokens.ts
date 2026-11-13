// Claim tokens for anonymous results (CLAUDE.md section 1, "Claiming").
// Kept in local storage as claim:<resultId> = { token, expiresAt }, only in the browser
// that took the quiz. Never put in a URL or logged.

const PREFIX = 'claim:'
const ONE_DAY_MS = 24 * 60 * 60 * 1000

type StoredToken = { token: string; expiresAt: number }

function parse(value: string | null): StoredToken | null {
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(value)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'token' in parsed &&
      typeof parsed.token === 'string' &&
      'expiresAt' in parsed &&
      typeof parsed.expiresAt === 'number'
    ) {
      return { token: parsed.token, expiresAt: parsed.expiresAt }
    }
  } catch {
    // Not ours, or damaged: treat as missing.
  }
  return null
}

export function saveClaimToken(resultId: string, token: string, now = Date.now()) {
  try {
    const stored: StoredToken = { token, expiresAt: now + ONE_DAY_MS }
    localStorage.setItem(PREFIX + resultId, JSON.stringify(stored))
  } catch {
    // Storage is full or blocked: the result can't be claimed later, but it still exists.
  }
}

// The token for a result, if this browser holds one that hasn't expired.
export function readClaimToken(resultId: string, now = Date.now()): string | null {
  try {
    const stored = parse(localStorage.getItem(PREFIX + resultId))
    return stored && stored.expiresAt > now ? stored.token : null
  } catch {
    return null
  }
}

export function removeClaimToken(resultId: string) {
  try {
    localStorage.removeItem(PREFIX + resultId)
  } catch {
    // Nothing to do.
  }
}

// Removes expired (or unreadable) tokens. Called once when the app starts.
export function pruneClaimTokens(now = Date.now()) {
  try {
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
    for (const key of keys) {
      if (!key?.startsWith(PREFIX)) continue
      const stored = parse(localStorage.getItem(key))
      if (!stored || stored.expiresAt <= now) localStorage.removeItem(key)
    }
  } catch {
    // Storage is blocked: nothing to prune.
  }
}
