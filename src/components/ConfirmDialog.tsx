import { useId, useRef, useState, type RefObject } from 'react'
import { flushSync } from 'react-dom'

export type ConfirmOptions = {
  title: string
  body: string
  confirmLabel: string
}

type ConfirmDialogProps = {
  dialogRef: RefObject<HTMLDialogElement | null>
  cancelRef: RefObject<HTMLButtonElement | null>
  options: ConfirmOptions | null
  onConfirm: () => void
  onClose: () => void
  // Shown (and announced) inside the dialog, for a confirm action that can fail and
  // keeps the dialog open, such as deleting a quiz from the dashboard.
  error?: string | null
}

// A native <dialog> asking the person to confirm or cancel. Use it through useConfirmDialog.
export function ConfirmDialog({
  dialogRef,
  cancelRef,
  options,
  onConfirm,
  onClose,
  error,
}: ConfirmDialogProps) {
  const headingId = useId()
  const bodyId = useId()

  return (
    <dialog
      ref={dialogRef}
      className="dialog-sm"
      aria-labelledby={headingId}
      aria-describedby={bodyId}
      onClose={onClose}
    >
      <div className="dialog-header">
        <h2 id={headingId}>{options?.title}</h2>
      </div>
      <div className="dialog-body">
        <p id={bodyId}>{options?.body}</p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </div>
      <div className="dialog-footer">
        <button
          ref={cancelRef}
          type="button"
          className="btn"
          onClick={() => dialogRef.current?.close()}
        >
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={onConfirm}>
          {options?.confirmLabel}
        </button>
      </div>
    </dialog>
  )
}

// Returns confirm(options), which opens the dialog and resolves true or false,
// and the dialog element to render. Opening happens in the caller's event handler, so
// there is no effect. Escape, Cancel and closing all resolve false.
export function useConfirmDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null)
  const [options, setOptions] = useState<ConfirmOptions | null>(null)

  function confirm(next: ConfirmOptions) {
    // Render the text first, so the dialog has its name when it opens.
    flushSync(() => setOptions(next))
    dialogRef.current?.showModal()
    cancelRef.current?.focus()
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
    })
  }

  function finish(confirmed: boolean) {
    const resolve = resolveRef.current
    resolveRef.current = null
    dialogRef.current?.close()
    resolve?.(confirmed)
  }

  const dialog = (
    <ConfirmDialog
      dialogRef={dialogRef}
      cancelRef={cancelRef}
      options={options}
      onConfirm={() => finish(true)}
      onClose={() => finish(false)}
    />
  )

  return { confirm, dialog }
}
