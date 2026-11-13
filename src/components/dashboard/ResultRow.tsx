import { Link } from '@tanstack/react-router'
import { formatPoints } from '../../lib/formatScore'
import type { MyResult } from '../../schemas/myResults'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

// What the member got: points for trivia, the winning outcome for personality.
function outcomeText(result: MyResult) {
  if (result.quiz_kind === 'personality') return result.winning_outcome_title ?? ''
  const questions = result.question_count ?? 0
  return `${formatPoints((result.score ?? 0) * questions)} / ${questions}`
}

// Plain text, never colour alone. No link: the result page links to the current version.
const statusTag = { current: null, updated: 'Quiz updated', deleted: 'Quiz deleted' } as const

export function ResultRow({ result }: { result: MyResult }) {
  const tag = statusTag[result.quiz_status]

  return (
    <article className="border padding margin-bottom">
      <h3>
        <Link to="/results/$resultId" params={{ resultId: result.id }}>
          {result.quiz_title}
        </Link>
      </h3>
      <p>
        <span className="label">{result.quiz_kind === 'trivia' ? 'Trivia' : 'Personality'}</span>{' '}
        {outcomeText(result)} ·{' '}
        <time dateTime={result.created_at}>{dateFormat.format(new Date(result.created_at))}</time>
        {tag && (
          <>
            {' '}
            · <span className="label">{tag}</span>
          </>
        )}
      </p>
    </article>
  )
}
