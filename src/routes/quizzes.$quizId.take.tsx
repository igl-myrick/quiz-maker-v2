import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { TakePage } from '../pages/TakePage'

// ?page= is a whole number from 1. Anything else becomes page 1.
const takeSearchSchema = z.object({ page: z.coerce.number().int().min(1).catch(1).default(1) })

export const Route = createFileRoute('/quizzes/$quizId/take')({
  validateSearch: (raw: Record<string, unknown>): { page: number } => takeSearchSchema.parse(raw),
  head: () => ({ meta: [{ title: 'Taking a quiz · Quiz Maker' }] }),
  component: TakeRoute,
})

function TakeRoute() {
  const { quizId } = Route.useParams()
  const { page } = Route.useSearch()
  return <TakePage quizId={quizId} page={page} />
}
