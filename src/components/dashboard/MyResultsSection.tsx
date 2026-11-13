import { Link } from '@tanstack/react-router'
import { useMyResults } from '../../hooks/useMyResults'
import { useShowMore } from '../../hooks/useShowMore'
import { ResultRow } from './ResultRow'

export function MyResultsSection() {
  const query = useMyResults()
  const { showMore, rowRef } = useShowMore(query)

  // Everything below is derived from the query, never copied into state.
  const results = query.data?.pages.flatMap((page) => page.items) ?? []

  let content
  if (query.isPending) {
    content = <p>Loading your results…</p>
  } else if (query.isError) {
    content = (
      <>
        <p>Couldn&apos;t load your results.</p>
        <button type="button" className="btn" onClick={() => void query.refetch()}>
          Try loading results again
        </button>
      </>
    )
  } else if (results.length === 0) {
    content = (
      <p>
        No saved results yet. <Link to="/search">Find a quiz</Link>
      </p>
    )
  } else {
    content = (
      <>
        <ul className="flat-list">
          {results.map((result) => (
            <li key={result.id} ref={rowRef(result.id)}>
              <ResultRow result={result} />
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
            {query.isFetchingNextPage ? 'Loading more results…' : 'Show more results'}
          </button>
        )}
      </>
    )
  }

  return (
    <section aria-labelledby="my-results-heading" className="margin-bottom">
      <h2 id="my-results-heading">My results</h2>
      {content}
    </section>
  )
}
