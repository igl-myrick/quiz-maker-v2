import { formatSuggestedTime } from '../../lib/formatSuggestedTime'

type QuizMetaProps = {
  questionCount: number
  suggestedTimeSeconds: number | null
}

// A quiz's question count and suggested time, each with a small decorative icon.
export function QuizMeta({ questionCount, suggestedTimeSeconds }: QuizMetaProps) {
  return (
    <p className="quiz-meta">
      <span>
        <svg aria-hidden="true" focusable="false" viewBox="0 0 14 14">
          <rect
            x="1.5"
            y="1.5"
            width="11"
            height="11"
            rx="3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M4.5 4.5h5M4.5 7h5M4.5 9.5h3"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
        {questionCount} questions
      </span>
      {suggestedTimeSeconds !== null && (
        <span>
          <svg aria-hidden="true" focusable="false" viewBox="0 0 14 14">
            <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M7 4v3.3l2 1.4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          {formatSuggestedTime(suggestedTimeSeconds)}
        </span>
      )}
    </p>
  )
}
