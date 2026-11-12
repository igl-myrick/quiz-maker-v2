import { useRef } from 'react'
import { LoginDialog, openLoginDialog } from './LoginDialog'

type LoginButtonProps = {
  label?: string
  // Called after a successful login. Pass it when this button disappears once the
  // person is logged in, so focus can move somewhere sensible instead of being lost.
  onLoggedIn?: () => void
}

// A reusable button that opens its own login popup, such as
// "Log in to save this result" (feature 3). Keep it mounted until its popup has closed,
// so focus can return to it, or pass onLoggedIn to move focus yourself.
export function LoginButton({ label = 'Log in', onLoggedIn }: LoginButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  function handleClick() {
    if (dialogRef.current) openLoginDialog(dialogRef.current)
  }

  return (
    <>
      <button type="button" className="btn" onClick={handleClick}>
        {label}
      </button>
      <LoginDialog dialogRef={dialogRef} onLoggedIn={onLoggedIn} />
    </>
  )
}
