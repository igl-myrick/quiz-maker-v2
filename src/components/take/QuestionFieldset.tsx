import type { TakeQuestion } from '../../schemas/submission'
import { useTakeStore } from '../../stores/takeStore'

// The first input of a question, which the error summary links to.
export function firstInputId(questionId: string) {
  return `answer-${questionId}-first`
}

type QuestionFieldsetProps = {
  takeKey: string
  question: TakeQuestion
  number: number
  total: number
  // The options chosen so far, read from the take store by the page.
  chosen: string[]
  showMissing: boolean
}

// One question: real radio buttons or checkboxes in a fieldset with the question as its
// legend (CLAUDE.md section 8). Controlled straight from the take store.
export function QuestionFieldset({
  takeKey,
  question,
  number,
  total,
  chosen,
  showMissing,
}: QuestionFieldsetProps) {
  const setAnswer = useTakeStore((state) => state.setAnswer)
  const isMulti = question.type === 'multi_select'
  const hintId = `answer-${question.id}-hint`
  const errorId = `answer-${question.id}-error`
  const describedBy = [isMulti ? hintId : null, showMissing ? errorId : null]
    .filter(Boolean)
    .join(' ')

  function handleChange(optionId: string, checked: boolean) {
    if (!isMulti) {
      setAnswer(takeKey, question.id, [optionId])
    } else {
      setAnswer(
        takeKey,
        question.id,
        checked ? [...chosen, optionId] : chosen.filter((id) => id !== optionId),
      )
    }
  }

  return (
    // data-missing draws a red bar down the left edge; the words below still say it.
    <fieldset
      className="question"
      data-missing={showMissing || undefined}
      aria-describedby={describedBy || undefined}
    >
      {/* The number and the prompt on separate lines; the hidden colon keeps the group's
          name as "Question N of M: prompt". */}
      <legend>
        <span className="question-number">
          Question {number} of {total}
        </span>
        <span className="sr-only">:</span>{' '}
        <span className="question-prompt">{question.prompt}</span>
      </legend>
      {isMulti && (
        <p id={hintId} className="form-desc">
          Choose all that apply
        </p>
      )}
      {showMissing && (
        <p id={errorId} className="error">
          Answer this question.
        </p>
      )}
      {question.options.map((option, index) => (
        <label key={option.id}>
          <input
            id={index === 0 ? firstInputId(question.id) : undefined}
            type={isMulti ? 'checkbox' : 'radio'}
            name={`question-${question.id}`}
            value={option.id}
            checked={chosen.includes(option.id)}
            onChange={(event) => handleChange(option.id, event.target.checked)}
          />{' '}
          {option.label}
        </label>
      ))}
    </fieldset>
  )
}
