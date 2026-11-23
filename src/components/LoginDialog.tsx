import { useMutation } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useId, type RefObject } from 'react'
import { clearAuthReturn, saveAuthReturn } from '../lib/authReturn'
import { supabase } from '../lib/supabase'

type Provider = 'google' | 'github'

const PROVIDERS: { id: Provider; name: string }[] = [
  { id: 'google', name: 'Google' },
  { id: 'github', name: 'GitHub' },
]

// Opens the login popup and puts focus on the first provider button.
// React's autoFocus can't do this, because the buttons mount while the dialog is closed.
export function openLoginDialog(dialog: HTMLDialogElement) {
  dialog.showModal()
  dialog.querySelector<HTMLButtonElement>('.login-provider')?.focus()
}

type LoginDialogProps = {
  dialogRef: RefObject<HTMLDialogElement | null>
  // The id of the element to focus after coming back logged in. Without one, focus goes
  // to the header's auth button. A callback wouldn't survive the redirect, so it's an id.
  returnFocusId?: string
}

export function LoginDialog({ dialogRef, returnFocusId }: LoginDialogProps) {
  const headingId = useId()

  // On success the browser is already leaving for the provider, so there is nothing to
  // do here: the callback route takes over when the person comes back.
  const login = useMutation({
    mutationFn: async (provider: Provider) => {
      saveAuthReturn(returnFocusId)
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) throw error
    },
    onError: (_error, provider) => {
      clearAuthReturn()
      dialogRef.current?.querySelector<HTMLButtonElement>(`[data-provider="${provider}"]`)?.focus()
    },
  })

  // Still disabled after success, while the browser leaves the page.
  const busy = login.isPending || login.isSuccess

  return (
    <dialog
      ref={dialogRef}
      className="dialog-sm"
      aria-labelledby={headingId}
      // Runs for Escape and for the close button: start again next time.
      onClose={() => login.reset()}
    >
      <div className="dialog-header">
        <h2 id={headingId}>Log in or sign up</h2>
        <button
          type="button"
          className="dialog-close"
          aria-label="Close"
          onClick={() => dialogRef.current?.close()}
        >
          ×
        </button>
      </div>

      <div className="dialog-body">
        <p>Use your Google or GitHub account. No password needed.</p>

        {login.isError && (
          <p role="alert" className="error">
            Something went wrong. Please try again.
          </p>
        )}

        <div className="login-providers">
          {PROVIDERS.map(({ id, name }) => (
            <button
              key={id}
              type="button"
              className="btn btn-primary login-provider"
              data-provider={id}
              disabled={busy}
              onClick={() => login.mutate(id)}
            >
              {login.variables === id && busy ? `Opening ${name}…` : `Continue with ${name}`}
            </button>
          ))}
        </div>

        <p className="text-sm">
          We only use your email address to keep your account. Your name and picture from Google or
          GitHub are never shown or shared.
        </p>
        {/* Closing first lets the page-change focus rule move focus to the new page's heading. */}
        <p className="text-sm">
          <Link
            to="/privacy"
            className="login-privacy-link"
            onClick={() => dialogRef.current?.close()}
          >
            Read the privacy page
          </Link>
        </p>
      </div>
    </dialog>
  )
}
