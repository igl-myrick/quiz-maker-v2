import { Link } from '@tanstack/react-router'
import { formatSuggestedTime } from '../lib/formatSuggestedTime'
import type { QuizSummary } from '../schemas/searchResult'
import '../styles/search.css'

type QuizCardProps = {
  quiz: QuizSummary
}

export function quizCardLinkId(quizId: string) {
  return `quiz-card-${quizId}`
}

export function QuizCard({ quiz }: QuizCardProps) {
  return (
    <article className="border padding margin-bottom">
      <h3>
        {/* Opens the details popup on top of the current search, keeping q. */}
        <Link
          id={quizCardLinkId(quiz.id)}
          to="/search"
          search={(prev) => ({ ...prev, quiz: quiz.id })}
        >
          {quiz.title}
        </Link>
      </h3>
      <p>
        <span className="label">{quiz.kind === 'trivia' ? 'Trivia' : 'Personality'}</span>{' '}
        <span className="text-secondary">
          {quiz.question_count} questions
          {quiz.suggested_time_seconds !== null &&
            ` · ${formatSuggestedTime(quiz.suggested_time_seconds)}`}
        </span>
      </p>
      {quiz.description && <p className="quiz-card-description">{quiz.description}</p>}
    </article>
  )
}
