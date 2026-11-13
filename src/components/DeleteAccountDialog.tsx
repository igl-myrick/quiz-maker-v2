import { zodResolver } from '@hookform/resolvers/zod'
import { useId, type RefObject } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useDeleteAccount } from '../hooks/useDeleteAccount'
import {
  deleteAccountSchema,
  isConfirmWord,
  type DeleteAccountValues,
} from '../schemas/deleteAccount'

// Opens the dialog with focus on Cancel, the safe choice.
export function openDeleteAccountDialog(dialog: HTMLDialogElement) {
  dialog.showModal()
  dialog.querySelector<HTMLButtonElement>('.dialog-footer button')?.focus()
}

type DeleteAccountDialogProps = {
  dialogRef: RefObject<HTMLDialogElement | null>
  // The settings popup underneath, closed too once the account is deleted.
  settingsDialogRef: RefObject<HTMLDialogElement | null>
}

// Stacked over the settings popup. Escape closes only this one, and focus returns to
// "Delete my account".
export function DeleteAccountDialog({ dialogRef, settingsDialogRef }: DeleteAccountDialogProps) {
  const headingId = useId()
  const bodyId = useId()
  const fieldId = useId()
  const errorId = useId()

  const form = useForm<DeleteAccountValues>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { confirmation: '' },
  })
  const confirmation = useWatch({ control: form.control, name: 'confirmation' })
  const fieldError = form.formState.errors.confirmation?.message

  const deleteAccount = useDeleteAccount(() => {
    dialogRef.current?.close()
    settingsDialogRef.current?.close()
  })

  // Only runs once the word matches; otherwise React Hook Form shows the error and
  // focuses the field.
  function handleConfirm() {
    // aria-disabled doesn't block clicks, so a second click is ignored here.
    if (deleteAccount.isPending) return
    deleteAccount.mutate()
  }

  // Escape or Cancel: start again next time.
  function handleClose() {
    form.reset()
    deleteAccount.reset()
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog-sm dialog-layer-2"
      aria-labelledby={headingId}
      aria-describedby={bodyId}
      onClose={handleClose}
    >
      <form noValidate onSubmit={form.handleSubmit(handleConfirm)}>
        <div className="dialog-header">
          <h2 id={headingId}>Delete your account?</h2>
        </div>
        <div className="dialog-body">
          <p id={bodyId}>
            This permanently deletes your account, your saved results and the quizzes you made. This
            can&apos;t be undone.
          </p>
          {deleteAccount.isError && (
            <p role="alert" className="error">
              Couldn&apos;t delete your account. Please try again.
            </p>
          )}
          <label htmlFor={fieldId}>Type delete to confirm</label>
          <input
            id={fieldId}
            type="text"
            autoComplete="off"
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? errorId : undefined}
            className={fieldError ? 'input-error' : undefined}
            {...form.register('confirmation')}
          />
          {fieldError && (
            <p id={errorId} className="error">
              {fieldError}
            </p>
          )}
        </div>
        <div className="dialog-footer">
          <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-red"
            aria-disabled={!isConfirmWord(confirmation) || deleteAccount.isPending}
          >
            {deleteAccount.isPending ? 'Deleting…' : 'Delete my account'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
