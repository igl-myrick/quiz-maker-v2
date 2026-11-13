import { Link } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useDeleteQuiz } from '../../hooks/useDeleteQuiz'
import { useMyQuizzes } from '../../hooks/useMyQuizzes'
import { useShowMore } from '../../hooks/useShowMore'
import type { QuizSummary } from '../../schemas/searchResult'
import { announce } from '../../stores/announcerStore'
import { ConfirmDialog } from '../ConfirmDialog'
import { QuizCard } from '../QuizCard'

export function MyQuizzesSection() {
  const query = useMyQuizzes()
  const { showMore, rowRef } = useShowMore(query)
  const deleteQuiz = useDeleteQuiz()

  // The only local state: which quiz the delete dialog is asking about.
  const [deleting, setDeleting] = useState<QuizSummary | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const quizzes = query.data?.pages.flatMap((page) => page.items) ?? []

  function openDeleteDialog(quiz: QuizSummary) {
    deleteQuiz.reset()
    // Render the quiz's title first, so the dialog has its name when it opens.
    flushSync(() => setDeleting(quiz))
    dialogRef.current?.showModal()
    cancelRef.current?.focus()
  }

  function handleConfirmDelete() {
    if (!deleting || deleteQuiz.isPending) return
    deleteQuiz.mutate(deleting.id, {
      onSuccess: () => {
        // Close first: while the modal is open the page behind it can't take focus.
        // The Delete button that opened it is gone, so focus goes to the heading.
        dialogRef.current?.close()
        headingRef.current?.focus()
        announce('Quiz deleted')
      },
      // On failure the dialog stays open and shows the error (an alert, so it's read out).
    })
  }

  let content
  if (query.isPending) {
    content = <p>Loading your quizzes…</p>
  } else if (query.isError) {
    content = (
      <>
        <p>Couldn&apos;t load your quizzes.</p>
        <button type="button" className="btn" onClick={() => void query.refetch()}>
          Try loading quizzes again
        </button>
      </>
    )
  } else if (quizzes.length === 0) {
    content = (
      <p>
        You haven&apos;t made a quiz yet. <Link to="/quizzes/new">Create one</Link>
      </p>
    )
  } else {
    content = (
      <>
        <ul className="flat-list">
          {quizzes.map((quiz) => (
            <li key={quiz.id} ref={rowRef(quiz.id)}>
              <QuizCard
                quiz={quiz}
                actions={
                  // Names include the title, so a list of them isn't just "Edit, Edit…".
                  <div className="btn-group">
                    <Link to="/quizzes/$quizId/edit" params={{ quizId: quiz.id }} className="btn">
                      Edit <span className="sr-only">{quiz.title}</span>
                    </Link>
                    <button
                      type="button"
                      className="btn btn-red"
                      onClick={() => openDeleteDialog(quiz)}
                    >
                      Delete <span className="sr-only">{quiz.title}</span>
                    </button>
                  </div>
                }
              />
            </li>
          ))}
        </ul>
        {query.hasNextPage && (
          // aria-disabled rather than disabled: a disabled button drops focus to the page.
          <button
            type="button"
            className="btn"
            aria-disabled={query.isFetchingNextPage}
            onClick={() => void showMore()}
          >
            {query.isFetchingNextPage ? 'Loading more quizzes…' : 'Show more quizzes'}
          </button>
        )}
      </>
    )
  }

  return (
    <section aria-labelledby="my-quizzes-heading" className="margin-bottom">
      <div className="display-flex justify-between items-center">
        <h2 id="my-quizzes-heading" ref={headingRef} tabIndex={-1}>
          My quizzes
        </h2>
        <Link to="/quizzes/new" className="btn">
          + Create quiz
        </Link>
      </div>
      {content}

      <ConfirmDialog
        dialogRef={dialogRef}
        cancelRef={cancelRef}
        options={
          deleting && {
            title: `Delete "${deleting.title}"?`,
            body: "This can't be undone. Results people already have will stay.",
            confirmLabel: deleteQuiz.isPending ? 'Deleting…' : 'Delete quiz',
          }
        }
        error={deleteQuiz.isError ? "Couldn't delete this quiz." : null}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleting(null)}
      />
    </section>
  )
}
