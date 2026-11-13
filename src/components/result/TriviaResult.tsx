import { formatPoints } from '../../lib/formatScore'
import type { Result, ResultQuestion } from '../../schemas/result'

function pointsText(points: number) {
  return `${formatPoints(points)} ${points === 1 ? 'point' : 'points'}`
}

function questionOutcome(score: number) {
  if (score === 1) return { icon: '✓', text: `Correct: ${pointsText(score)}` }
  if (score > 0) return { icon: '◐', text: `Partly correct: ${pointsText(score)}` }
  return { icon: '✗', text: `Wrong: ${pointsText(score)}` }
}

// What an option means for this taker. The text carries the meaning; icons are decorative.
function optionNote(option: ResultQuestion['options'][number], chosen: boolean) {
  if (option.is_correct) return chosen ? 'your answer, correct' : "correct answer you didn't choose"
  return chosen ? 'your answer, not correct' : 'not correct'
}

export function TriviaResult({ result }: { result: Result }) {
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
      <p>
        <strong>
          {formatPoints(points)} / {questions.length} ({percent}%)
        </strong>
      </p>
      <p>
        <span aria-hidden="true">✓ </span>
        {correct} correct · <span aria-hidden="true">◐ </span>
        {partly} partly correct · <span aria-hidden="true">✗ </span>
        {wrong} wrong
      </p>

      <h2>Question by question</h2>
      <ol className="flat-list">
        {questions.map((question, index) => {
          const outcome = questionOutcome(question.score ?? 0)
          return (
            <li key={question.id} className="border padding margin-bottom">
              <h3>
                Question {index + 1}: {question.prompt}
              </h3>
              <p>
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
