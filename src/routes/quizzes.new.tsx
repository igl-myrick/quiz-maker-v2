import { createFileRoute } from '@tanstack/react-router'
import { QuizEditorPage } from '../pages/QuizEditorPage'
import { parseEditorSearch } from '../schemas/quiz'

export const Route = createFileRoute('/quizzes/new')({
  validateSearch: parseEditorSearch,
  head: () => ({ meta: [{ title: 'Create a quiz · Quiz Maker' }] }),
  component: NewQuizRoute,
})

function NewQuizRoute() {
  const { part } = Route.useSearch()
  return <QuizEditorPage quizId={null} part={part ?? 'basics'} />
}
