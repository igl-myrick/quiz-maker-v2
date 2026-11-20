import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { setLoginArrival, takeAuthReturn, type LoginArrival } from '../lib/authReturn'
import { supabase } from '../lib/supabase'

const LOGGED_IN = "You're logged in"
const CANCELLED = "Login cancelled. You're still logged out."
const FAILED = "Couldn't log you in. Please try again."

type AuthCallbackPageProps = {
  code: string | undefined
  error: string | undefined
}

// Works out what to focus and announce once the person is back on their page.
async function finishLogin(
  code: string | undefined,
  error: string | undefined,
  focusId: string | undefined,
): Promise<LoginArrival | null> {
  if (error) return { message: error === 'access_denied' ? CANCELLED : FAILED }
  if (!code) return null

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) return { message: FAILED }
  return { focusId, message: LOGGED_IN }
}

export function AuthCallbackPage({ code, error }: AuthCallbackPageProps) {
  const navigate = useNavigate()
  // A code can only be exchanged once, so this runs once even when React's Strict Mode
  // runs effects twice in development (refs survive that second run).
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const saved = takeAuthReturn()
    void finishLogin(code, error, saved.focusId).then((arrival) => {
      if (arrival) setLoginArrival(arrival)
      // Replace, so Back doesn't land on this page again.
      return navigate({ href: saved.path, replace: true })
    })
  }, [code, error, navigate])

  return (
    <main className="units-container">
      <h1 tabIndex={-1}>Logging you in…</h1>
    </main>
  )
}
