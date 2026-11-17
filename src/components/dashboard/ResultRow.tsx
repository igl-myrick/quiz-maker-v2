import { Link } from '@tanstack/react-router'
import { formatPoints } from '../../lib/formatScore'
import type { MyResult } from '../../schemas/myResults'
import { KindChip } from '../ui/KindChip'
import { StripArt } from '../ui/StripArt'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

// Plain text, never colour alone. No link: the result page links to the current version.
const statusTag = { current: null, updated: 'Quiz updated', deleted: 'Quiz deleted' } as const

// One saved result as a card: the title link is stretched over the whole card, so it is
// one link and one tab stop. Cards are never inside the personality highlight; only the
// strip and chip show the kind colour.
export function ResultRow({ result }: { result: MyResult }) {
  const tag = statusTag[result.quiz_status]
  const questions = result.question_count ?? 0
  const score = result.score ?? 0

  return (
    <article className="result-card">
      <div className="result-card-strip" data-strip-kind={result.quiz_kind}>
        <StripArt kind={result.quiz_kind} />
      </div>
      <div className="result-card-main">
        <h3>
          <Link to="/results/$resultId" params={{ resultId: result.id }}>
            {result.quiz_title}
          </Link>
        </h3>
        {/* After the heading, so jumping to the heading still reaches it; CSS shows it first. */}
        <KindChip kind={result.quiz_kind} />
        {result.quiz_kind === 'personality' ? (
          <p className="result-score">{result.winning_outcome_title ?? ''}</p>
        ) : (
          <>
            <p className="result-score">
              {formatPoints(score * questions)} / {questions}
            </p>
            {/* The score is in words just above, so the bar is decoration. */}
            <div className="score-bar" aria-hidden="true">
              <span style={{ width: `${Math.round(score * 100)}%` }} />
            </div>
          </>
        )}
        <p className="result-card-meta">
          <time dateTime={result.created_at}>{dateFormat.format(new Date(result.created_at))}</time>
          {tag && <span className="status-tag">{tag}</span>}
        </p>
      </div>
    </article>
  )
}
