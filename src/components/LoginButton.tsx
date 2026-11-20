import { useRef } from 'react'
import { LoginDialog, openLoginDialog } from './LoginDialog'

type LoginButtonProps = {
  label?: string
  // The id of the element to focus after coming back logged in. Pass it when this button
  // disappears once the person is logged in. Without it, focus goes to the header's auth button.
  returnFocusId?: string
}

// A reusable button that opens its own login popup, such as
// "Log in to create a quiz" or "Log in to submit".
export function LoginButton({ label = 'Log in', returnFocusId }: LoginButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  function handleClick() {
    if (dialogRef.current) openLoginDialog(dialogRef.current)
  }

  return (
    <>
      <button type="button" className="btn" onClick={handleClick}>
        {label}
      </button>
      <LoginDialog dialogRef={dialogRef} returnFocusId={returnFocusId} />
    </>
  )
}
