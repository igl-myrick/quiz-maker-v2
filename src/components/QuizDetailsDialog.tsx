import { useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect, useId, useRef, type SyntheticEvent } from 'react'
import { useQuizDetails } from '../hooks/useQuizDetails'
import { StartQuizControls } from './StartQuizControls'
import { KindChip } from './ui/KindChip'
import { QuizMeta } from './ui/QuizMeta'
import { StripArt } from './ui/StripArt'

type QuizDetailsDialogProps = {
  quizId: string
}

// Rendered by SearchPage only while ?quiz=<id> is in the URL.
export function QuizDetailsDialog({ quizId }: QuizDetailsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closingRef = useRef(false)
  const headingId = useId()

  const router = useRouter()
  const navigate = useNavigate()
  const canGoBack = useCanGoBack()
  const { data: quiz, isPending, isError, refetch } = useQuizDetails(quizId)

  // The one effect in this feature: keep the browser's modal in step with React.
  // Open on mount. On unmount, close first (so the page is no longer inert),
  // then return focus to whatever opened the popup, or to the page heading.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const opener = document.activeElement !== document.body ? document.activeElement : null
    closingRef.current = false
    dialog.showModal()

    return () => {
      // Closing here (say, after the Back button) must not trigger requestClose again.
      closingRef.current = true
      dialog.close()
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus()
      } else {
        document.querySelector<HTMLElement>('main h1')?.focus()
      }
    }
  }, [])

  // Shared by the close button, Escape and the dialog's own close event.
  function requestClose() {
    if (closingRef.current) return
    closingRef.current = true

    if (canGoBack) {
      router.history.back()
    } else {
      // Opened from a shared link: go to the plain search URL without adding a history entry.
      void navigate({
        to: '/search',
        search: (prev) => ({ ...prev, quiz: undefined }),
        replace: true,
      })
    }
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault()
    requestClose()
  }

  // Chrome can close a dialog on a second Escape without a cancel event.
  // Ignore close events while the dialog is still open (React StrictMode reopens it in development).
  function handleCloseEvent() {
    if (dialogRef.current?.open) return
    requestClose()
  }

  let heading = 'Quiz details'
  if (quiz) heading = quiz.title
  else if (quiz === null) heading = 'Quiz not found'

  const closeButton = (
    <button type="button" className="dialog-close" aria-label="Close" onClick={requestClose}>
      ×
    </button>
  )

  return (
    <dialog
      ref={dialogRef}
      className="details-dialog"
      // Personality quizzes turn the popup's buttons, links and focus purple, including
      // the "Start over?" confirm opened from inside it.
      data-kind={quiz?.kind === 'personality' ? 'personality' : undefined}
      aria-labelledby={headingId}
      onCancel={handleCancel}
      onClose={handleCloseEvent}
    >
      {quiz ? (
        <div className="details-layout">
          <div className="details-strip" data-strip-kind={quiz.kind}>
            <StripArt kind={quiz.kind} />
          </div>
          <div className="details-main">
            <div className="details-top">
              <KindChip kind={quiz.kind} />
              {closeButton}
            </div>
            <h2 id={headingId}>{heading}</h2>
            <QuizMeta
              questionCount={quiz.question_count}
              suggestedTimeSeconds={quiz.suggested_time_seconds}
            />
            {quiz.description && <p className="details-description">{quiz.description}</p>}
            <div className="details-footer">
              <StartQuizControls
                quizId={quiz.id}
                suggestedTimeSeconds={quiz.suggested_time_seconds}
                variant="popup"
              />
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="dialog-header">
            <h2 id={headingId}>{heading}</h2>
            {closeButton}
          </div>
          <div className="dialog-body">
            {isPending && <p>Loading quiz…</p>}

            {isError && (
              <>
                <p>Couldn&apos;t load this quiz.</p>
                <button type="button" className="btn" onClick={() => void refetch()}>
                  Try again
                </button>
              </>
            )}

            {quiz === null && <p>This quiz no longer exists.</p>}
          </div>
        </>
      )}
    </dialog>
  )
}
