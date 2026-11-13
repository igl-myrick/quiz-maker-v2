import { Link } from '@tanstack/react-router'
import { formatClock } from '../../hooks/useCountdown'
import type { ResultOk } from '../../schemas/result'

export function ResultNotices({ data }: { data: ResultOk }) {
  const { result } = data
  const suggested = result.snapshot.quiz.suggested_time_seconds

  return (
    <>
      {result.timed && result.duration_seconds !== null && suggested !== null && (
        <p>
          Finished in {formatClock(result.duration_seconds)} (suggested {formatClock(suggested)})
        </p>
      )}

      {data.quiz_updated && result.quiz_id && (
        <p>
          This quiz has been updated since this result was saved.{' '}
          <Link to="/search" search={{ quiz: result.quiz_id }}>
            See the current version
          </Link>
        </p>
      )}
      {!data.quiz_exists && <p>The original quiz no longer exists.</p>}

      {result.expires_at && (
        <p>
          This result is kept until{' '}
          {new Date(result.expires_at).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
          .
        </p>
      )}
    </>
  )
}
