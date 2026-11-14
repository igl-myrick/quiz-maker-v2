import { FieldError } from 'quiz-maker'

export function WithField() {
  return (
    <div className="form">
      <label htmlFor="field-title">Title</label>
      <input
        id="field-title"
        type="text"
        className="input-error"
        aria-invalid
        aria-describedby="field-title-error"
        defaultValue="Capitals Quiz"
      />
      <FieldError id="field-title-error" message="You already have a quiz with this title." />
    </div>
  )
}

export function MessageOnly() {
  return <FieldError id="field-questions-error" message="Add at least 3 questions." />
}
