import { ErrorSummary } from 'quiz-maker'
import { useRef } from 'react'

export function UnansweredQuestions() {
  const summaryRef = useRef<HTMLDivElement>(null)
  return (
    <ErrorSummary
      summaryRef={summaryRef}
      heading="Answer these questions before submitting"
      items={[
        {
          questionId: 'q2',
          text: 'Question 2: Which of these cities are capitals?',
          targetId: 'answer-q2-first',
        },
        {
          questionId: 'q5',
          text: 'Question 5: What is the capital of Canada?',
          targetId: 'answer-q5-first',
        },
      ]}
      onSelect={() => {}}
    />
  )
}

export function QuizChanged() {
  const summaryRef = useRef<HTMLDivElement>(null)
  return (
    <ErrorSummary
      summaryRef={summaryRef}
      heading="This quiz has changed"
      items={[]}
      onSelect={() => {}}
    >
      <p>The quiz was edited after you started, and your answers can no longer be graded.</p>
      <button type="button" className="btn btn-primary">
        Start the current version
      </button>
    </ErrorSummary>
  )
}
