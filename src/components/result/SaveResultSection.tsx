import { Link } from '@tanstack/react-router'
import { useRef } from 'react'
import { useClaimResult } from '../../hooks/useClaimResult'
import { readClaimToken } from '../../lib/claimTokens'
import { focusOnMount } from '../../lib/focusOnMount'
import type { ResultOk } from '../../schemas/result'
import { useSession } from '../../stores/authStore'
import { LoginDialog, openLoginDialog } from '../LoginDialog'

// "Save to my account" for an anonymous result, only in the browser holding its claim
// token (feature 3, criteria 20 to 22). What shows is worked out on every render from the
// claim mutation, the session, get_result and the stored token. Nothing is copied into state.
//
// Outcome messages are focused as they appear, which reads them out. They aren't also
// announced, which would read them twice.
export function SaveResultSection({ data }: { data: ResultOk }) {
  const resultId = data.result.id
  const session = useSession()
  const claim = useClaimResult(resultId)
  const dialogRef = useRef<HTMLDialogElement>(null)

  // After a claim the token is gone and the result is no longer claimable, so the
  // outcome has to come first.
  if (claim.isSuccess) {
    return claim.data ? (
      <p ref={focusOnMount} tabIndex={-1}>
        Saved to your account. <Link to="/dashboard">See your dashboard</Link>
      </p>
    ) : (
      <p ref={focusOnMount} tabIndex={-1}>
        This result can&apos;t be saved. It may have expired or already been saved.
      </p>
    )
  }

  const token = readClaimToken(resultId)
  if (!data.claimable || !token) return null

  // One button that stays mounted as the person logs in, so focus returns to it when the
  // login popup closes. Saving is always a separate press.
  function handleClick() {
    if (!session) {
      if (dialogRef.current) openLoginDialog(dialogRef.current)
    } else if (!claim.isPending && token) {
      claim.mutate(token)
    }
  }

  let label = 'Log in to save this result'
  if (session) label = claim.isPending ? 'Saving…' : 'Save to my account'

  return (
    <div className="margin-bottom">
      {/* aria-disabled rather than disabled: a disabled button drops focus to the page. */}
      <button
        type="button"
        className="btn btn-primary"
        aria-disabled={claim.isPending}
        onClick={handleClick}
      >
        {label}
      </button>
      {claim.isError && (
        // The token is kept, so the button stays for another try.
        <p ref={focusOnMount} tabIndex={-1} className="error">
          Something went wrong. Please try again.
        </p>
      )}
      <LoginDialog dialogRef={dialogRef} />
    </div>
  )
}
