import { Link } from '@tanstack/react-router'
import { useRef } from 'react'
import { logOut, useAuthStatus, useSession } from '../stores/authStore'
import { LoginDialog, openLoginDialog } from './LoginDialog'

export function SiteHeader() {
  const status = useAuthStatus()
  const session = useSession()
  const dialogRef = useRef<HTMLDialogElement>(null)

  // One button that never unmounts: its label and action switch with login state,
  // so focus can return to it after the popup closes.
  function handleAuthClick() {
    if (session) {
      void logOut()
    } else if (dialogRef.current) {
      openLoginDialog(dialogRef.current)
    }
  }

  return (
    <header>
      <nav className="navbar" aria-label="Main">
        <ul>
          <li>
            <Link to="/" activeOptions={{ exact: true }}>
              Quiz Maker
            </Link>
          </li>
          <li>
            {/* Marked aria-current="page" on /search, whatever the search terms. */}
            <Link to="/search" activeOptions={{ includeSearch: false }}>
              Search
            </Link>
          </li>
          <li>
            {/* Hidden (but still taking up space) until Supabase reports the first session state. */}
            <button
              type="button"
              className="btn"
              style={status === 'loading' ? { visibility: 'hidden' } : undefined}
              onClick={handleAuthClick}
            >
              {session ? 'Log out' : 'Log in'}
            </button>
          </li>
        </ul>
      </nav>
      <LoginDialog dialogRef={dialogRef} />
    </header>
  )
}
