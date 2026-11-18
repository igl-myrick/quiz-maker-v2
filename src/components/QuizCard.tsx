import { Link, useLocation, useRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { rememberReturnFocus } from '../lib/returnFocus'
import type { QuizSummary } from '../schemas/searchResult'
import '../styles/search.css'
import { KindChip } from './ui/KindChip'
import { QuizMeta } from './ui/QuizMeta'

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
  const onSearchPage = useLocation({ select: (location) => location.pathname === '/search' })

  // Opening the popup from another page (the dashboard) unmounts that page, so record
  // this link for the root route to focus on coming back. The search page stays mounted
  // under its popup and puts focus back itself.
  function handleClick() {
    if (!onSearchPage) {
      rememberReturnFocus(router.state.location.state.__TSR_key, quizCardLinkId(quiz.id))
    }
  }

  return (
    // The title link is stretched over the whole card in CSS, so clicking anywhere on the
    // card opens the quiz while it stays one link and one tab stop. Actions sit above it.
    <article className="quiz-card">
      <h3>
        {/* Opens the details popup on top of the current search, keeping q. On the
            search page itself, the results behind the popup stay where they were
            scrolled to; from another page, the search page starts at the top. */}
        <Link
          id={quizCardLinkId(quiz.id)}
          to="/search"
          search={(prev) => ({ ...prev, quiz: quiz.id })}
          resetScroll={!onSearchPage}
          onClick={handleClick}
        >
          {quiz.title}
        </Link>
      </h3>
      {/* After the heading, so jumping to the heading still reaches it; CSS shows it first. */}
      <KindChip kind={quiz.kind} />
      {quiz.description && <p className="quiz-card-description">{quiz.description}</p>}
      <QuizMeta
        questionCount={quiz.question_count}
        suggestedTimeSeconds={quiz.suggested_time_seconds}
      />
      {actions && <div className="quiz-card-actions">{actions}</div>}
    </article>
  )
}
