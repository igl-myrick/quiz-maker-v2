import { useRef } from 'react'
import { openSettingsDialog, SettingsDialog } from './SettingsDialog'

// The header's Settings button, for everyone. It never unmounts, so focus can return
// to it when the popup closes.
export function SettingsButton() {
  const dialogRef = useRef<HTMLDialogElement>(null)

  return (
    <>
      <button
        type="button"
        className="btn"
        onClick={() => {
          if (dialogRef.current) openSettingsDialog(dialogRef.current)
        }}
      >
        Settings
      </button>
      <SettingsDialog dialogRef={dialogRef} />
    </>
  )
}
