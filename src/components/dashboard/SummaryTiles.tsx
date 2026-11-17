import { useDashboardSummary } from '../../hooks/useDashboardSummary'

// Results saved, quizzes made and the average trivia score. A description list, so each
// figure is read with its label. It has its own loading and error state, so a failure
// here never hides the lists below.
export function SummaryTiles() {
  const query = useDashboardSummary()

  if (query.isPending) return <p>Loading your summary…</p>
  if (query.isError) {
    return (
      <>
        <p>Couldn&apos;t load your summary.</p>
        <button type="button" className="btn" onClick={() => void query.refetch()}>
          Try loading summary again
        </button>
      </>
    )
  }

  const { results_saved, quizzes_made, average_trivia_score } = query.data
  const average = average_trivia_score === null ? '—' : `${Math.round(average_trivia_score * 100)}%`

  return (
    <dl className="summary-tiles">
      <div className="summary-tile">
        <dt>Results saved</dt>
        <dd>{results_saved}</dd>
      </div>
      <div className="summary-tile">
        <dt>Quizzes made</dt>
        <dd>{quizzes_made}</dd>
      </div>
      <div className="summary-tile">
        <dt>Average trivia score</dt>
        <dd>{average}</dd>
      </div>
    </dl>
  )
}
