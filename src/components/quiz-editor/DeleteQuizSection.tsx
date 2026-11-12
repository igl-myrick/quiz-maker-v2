import { useDeleteQuiz } from '../../hooks/useDeleteQuiz'
import { useConfirmDialog } from '../ConfirmDialog'

type DeleteQuizSectionProps = {
  quizId: string
  title: string
}

// Until the dashboard exists (feature 3), quizzes are deleted from their edit page.
export function DeleteQuizSection({ quizId, title }: DeleteQuizSectionProps) {
  const deleteQuiz = useDeleteQuiz()
  const { confirm, dialog } = useConfirmDialog()

  async function handleDelete() {
    const confirmed = await confirm({
      title: `Delete "${title}"?`,
      body: "This can't be undone. Results people already have will stay.",
      confirmLabel: 'Delete quiz',
    })
    if (confirmed) deleteQuiz.mutate(quizId)
  }

  return (
    <section aria-labelledby="delete-quiz-heading" className="margin-bottom">
      <h2 id="delete-quiz-heading">Delete quiz</h2>
      {deleteQuiz.isError && (
        <p role="alert" className="error">
          Couldn&apos;t delete this quiz.
        </p>
      )}
      <button
        type="button"
        className="btn btn-red"
        disabled={deleteQuiz.isPending}
        onClick={() => void handleDelete()}
      >
        {deleteQuiz.isPending ? 'Deleting…' : 'Delete quiz'}
      </button>
      {dialog}
    </section>
  )
}
