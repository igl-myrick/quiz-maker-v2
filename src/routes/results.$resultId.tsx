import { createFileRoute } from '@tanstack/react-router'
import { resultQuery } from '../hooks/useResult'
import { queryClient } from '../lib/queryClient'
import { ResultPage } from '../pages/ResultPage'

export const Route = createFileRoute('/results/$resultId')({
  // Load the result before showing the page, so the tab title can name the quiz.
  // A failure is left for the page to show (with "Try again"), not the router.
  loader: ({ params }) =>
    queryClient.ensureQueryData(resultQuery(params.resultId)).catch(() => null),
  head: ({ loaderData }) => ({
    meta: [
      {
        title:
          loaderData?.status === 'ok'
            ? `Result: ${loaderData.result.quiz_title} · Quiz Maker`
            : 'Result · Quiz Maker',
      },
    ],
  }),
  component: ResultRoute,
})

function ResultRoute() {
  const { resultId } = Route.useParams()
  return <ResultPage resultId={resultId} />
}
