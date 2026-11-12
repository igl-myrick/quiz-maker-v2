import { createFileRoute } from '@tanstack/react-router'
import { QuizEditorPage } from '../pages/QuizEditorPage'
import { parseEditorSearch } from '../schemas/quiz'

export const Route = createFileRoute('/quizzes/$quizId/edit')({
  validateSearch: parseEditorSearch,
  head: () => ({ meta: [{ title: 'Edit quiz · Quiz Maker' }] }),
  component: EditQuizRoute,
})

function EditQuizRoute() {
  const { quizId } = Route.useParams()
  const { part } = Route.useSearch()
  return <QuizEditorPage quizId={quizId} part={part ?? 'basics'} />
}
