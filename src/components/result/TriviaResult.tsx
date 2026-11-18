import type { ReactNode } from 'react'
import { formatPoints } from '../../lib/formatScore'
import type { Result, ResultQuestion } from '../../schemas/result'

function pointsText(points: number) {
  return `${formatPoints(points)} ${points === 1 ? 'point' : 'points'}`
}

function questionOutcome(score: number) {
  if (score === 1) return { status: 'correct', icon: '✓', text: `Correct: ${pointsText(score)}` }
  if (score > 0) {
    return { status: 'partly', icon: '◐', text: `Partly correct: ${pointsText(score)}` }
  }
  return { status: 'wrong', icon: '✗', text: `Wrong: ${pointsText(score)}` }
}

// What an option means for this taker. The text carries the meaning; icons are decorative.
function optionNote(option: ResultQuestion['options'][number], chosen: boolean) {
  if (option.is_correct) return chosen ? 'your answer, correct' : 'correct answer'
  return chosen ? 'your answer, not correct' : 'not correct'
}

type TriviaResultProps = {
  result: Result
  // Copy link and Find another quiz, shown inside the score card.
  actions: ReactNode
  // Notices and Save to my account, between the score card and the questions.
  children?: ReactNode
}

export function TriviaResult({ result, actions, children }: TriviaResultProps) {
  const questions = result.snapshot.questions
  const scores = questions.map((question) => question.score ?? 0)
  const points = scores.reduce((sum, score) => sum + score, 0)
  const percent = Math.round((points / questions.length) * 100)
  const correct = scores.filter((score) => score === 1).length
  const partly = scores.filter((score) => score > 0 && score < 1).length
  const wrong = scores.filter((score) => score === 0).length

  return (
    <>
      <h1 tabIndex={-1}>{result.quiz_title}</h1>
      <div className="score-card">
        <p className="score-value">
          {formatPoints(points)} / {questions.length} ({percent}%)
        </p>
        {/* The score is in words just above, so the bar is decoration. */}
        <div className="score-bar" aria-hidden="true">
          <span style={{ width: `${percent}%` }} />
        </div>
        {/* Separators stay in the text for anyone copying it, but are hidden on screen. */}
        <p className="tally">
          <span>
            <span aria-hidden="true">✓ </span>
            {correct} correct
          </span>
          <span className="tally-sep" aria-hidden="true">
            {' · '}
          </span>
          <span>
            <span aria-hidden="true">◐ </span>
            {partly} partly correct
          </span>
          <span className="tally-sep" aria-hidden="true">
            {' · '}
          </span>
          <span>
            <span aria-hidden="true">✗ </span>
            {wrong} wrong
          </span>
        </p>
        <div className="result-actions">{actions}</div>
      </div>

      {children}

      <h2>Question by question</h2>
      <ol className="flat-list">
        {questions.map((question, index) => {
          const outcome = questionOutcome(question.score ?? 0)
          return (
            <li key={question.id} className="result-question">
              <h3>
                Question {index + 1}: {question.prompt}
              </h3>
              <p className="status-badge" data-status={outcome.status}>
                <span aria-hidden="true">{outcome.icon} </span>
                {outcome.text}
              </p>
              <ul>
                {question.options.map((option) => {
                  const chosen = question.selected_option_ids.includes(option.id)
                  return (
                    <li key={option.id}>
                      <span aria-hidden="true">{option.is_correct ? '✓ ' : '✗ '}</span>
                      {option.label}{' '}
                      <span className="text-secondary">({optionNote(option, chosen)})</span>
                    </li>
                  )
                })}
              </ul>
            </li>
          )
        })}
      </ol>
    </>
  )
}
