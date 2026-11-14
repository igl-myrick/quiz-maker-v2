import { ConfirmDialog } from 'quiz-maker'
import { useEffect, useRef } from 'react'

// The dialog is opened non-modally here so it renders inside the preview card.
// In the app it opens with dialogRef.current.showModal() (see useConfirmDialog).
function OpenDialog({ error }: { error?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    dialogRef.current?.show()
  }, [])
  return (
    <ConfirmDialog
      dialogRef={dialogRef}
      cancelRef={cancelRef}
      options={{
        title: 'Delete "World Capitals"?',
        body: 'This removes the quiz for everyone. Results people already have are kept.',
        confirmLabel: 'Delete quiz',
      }}
      onConfirm={() => {}}
      onClose={() => {}}
      error={error}
    />
  )
}

export function DeleteQuiz() {
  return <OpenDialog />
}

export function WithError() {
  return <OpenDialog error="The quiz could not be deleted. Check your connection and try again." />
}
