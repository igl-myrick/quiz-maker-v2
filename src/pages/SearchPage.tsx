import { QuizCard } from '../components/QuizCard'
import { QuizDetailsDialog } from '../components/QuizDetailsDialog'
import { SearchForm } from '../components/SearchForm'
import { useQuizSearch } from '../hooks/useQuizSearch'
import { useShowMore } from '../hooks/useShowMore'

type SearchPageProps = {
  q: string | undefined
  quizId: string | undefined
}

function countText(count: number) {
  return count === 1 ? '1 quiz' : `${count} quizzes`
}

export function SearchPage({ q, quizId }: SearchPageProps) {
  const search = useQuizSearch(q)
  const { showMore, rowRef } = useShowMore(search)

  // Everything below is derived from the query, never copied into state.
  const pages = search.data?.pages ?? []
  const firstPage = pages[0]
  const quizzes = pages.flatMap((page) => page.items)
  const mode = firstPage?.mode

  let status = ''
  if (search.isPending) status = 'Loading quizzes…'
  else if (search.isError) status = "Couldn't load quizzes."
  else if (mode === 'no_terms') status = 'Try more specific words'
  else if (firstPage && firstPage.total === 0) status = 'No quizzes found'
  else if (firstPage && search.hasNextPage) {
    status = `${countText(firstPage.total)} found, showing ${quizzes.length}`
  } else if (firstPage) status = `${countText(firstPage.total)} found`

  return (
    <main className="units-container">
      <h1 tabIndex={-1}>Find a quiz</h1>
      <SearchForm q={q} />

      <h2>{q ? `Results for "${q}"` : 'All quizzes'}</h2>

      {/* Always on the page, so the outcome is announced once results load. */}
      <p role="status">{status}</p>

      {search.isError && (
        <button type="button" className="btn" onClick={() => void search.refetch()}>
          Try again
        </button>
      )}

      {mode === 'search' && firstPage?.total === 0 && (
        <p>No quizzes match &quot;{q}&quot;. Try different words.</p>
      )}

      {quizzes.length > 0 && (
        <ul className="flat-list">
          {quizzes.map((quiz) => (
            <li key={quiz.id} ref={rowRef(quiz.id)}>
              <QuizCard quiz={quiz} />
            </li>
          ))}
        </ul>
      )}

      {search.hasNextPage && (
        // aria-disabled rather than disabled: a disabled button drops focus to the page.
        <button
          type="button"
          className="btn"
          aria-disabled={search.isFetchingNextPage}
          onClick={() => void showMore()}
        >
          {search.isFetchingNextPage ? 'Loading…' : 'Show more'}
        </button>
      )}

      {quizId && <QuizDetailsDialog quizId={quizId} />}
    </main>
  )
}
