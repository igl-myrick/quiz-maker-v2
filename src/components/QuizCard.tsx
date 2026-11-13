import { Link, useRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { formatSuggestedTime } from '../lib/formatSuggestedTime'
import { rememberReturnFocus } from '../lib/returnFocus'
import type { QuizSummary } from '../schemas/searchResult'
import '../styles/search.css'

type QuizCardProps = {
  quiz: QuizSummary
  // Optional buttons or links under the card, such as the dashboard's Edit and Delete.
  actions?: ReactNode
}

export function quizCardLinkId(quizId: string) {
  return `quiz-card-${quizId}`
}

export function QuizCard({ quiz, actions }: QuizCardProps) {
  const router = useRouter()

  // Opening the popup from another page (the dashboard) unmounts that page, so record
  // this link for the root route to focus on coming back. The search page stays mounted
  // under its popup and puts focus back itself.
  function handleClick() {
    const location = router.state.location
    if (location.pathname !== '/search') {
      rememberReturnFocus(location.state.__TSR_key, quizCardLinkId(quiz.id))
    }
  }

  return (
    <article className="border padding margin-bottom">
      <h3>
        {/* Opens the details popup on top of the current search, keeping q. */}
        <Link
          id={quizCardLinkId(quiz.id)}
          to="/search"
          search={(prev) => ({ ...prev, quiz: quiz.id })}
          onClick={handleClick}
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
      {actions}
    </article>
  )
}
