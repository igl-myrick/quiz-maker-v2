import { createFileRoute } from '@tanstack/react-router'
import { SearchPage } from '../pages/SearchPage'
import { parseSearchParams } from '../schemas/search'

export const Route = createFileRoute('/search')({
  validateSearch: parseSearchParams,
  head: () => ({ meta: [{ title: 'Find a quiz · Quiz Maker' }] }),
  component: SearchRoute,
})

function SearchRoute() {
  const { q, quiz } = Route.useSearch()
  return <SearchPage q={q} quizId={quiz} />
}
