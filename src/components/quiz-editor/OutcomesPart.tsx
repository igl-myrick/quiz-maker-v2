import { flushSync } from 'react-dom'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { emptyOutcome, type QuizFormInput, type QuizFormValues } from '../../schemas/quiz'
import { QUIZ_LIMITS } from '../../schemas/quizLimits'
import { announce } from '../../stores/announcerStore'
import { useConfirmDialog } from '../ConfirmDialog'
import { FieldError, fieldDomId, fieldProps } from './FieldError'

export const ADD_OUTCOME_ID = 'add-outcome'

function outcomeElementId(fieldId: string, what: 'legend' | 'up' | 'down') {
  return `outcome-${fieldId}-${what}`
}

export function OutcomesPart() {
  const { control, register, getValues, setValue, formState } = useFormContext<
    QuizFormInput,
    unknown,
    QuizFormValues
  >()
  const { fields, append, remove, move } = useFieldArray({ control, name: 'outcomes' })
  const { confirm, dialog } = useConfirmDialog()
  const rootError = formState.errors.outcomes?.root?.message

  function moveOutcome(from: number, to: number, button: 'up' | 'down') {
    if (to < 0 || to >= fields.length) return
    const fieldId = fields[from].id
    flushSync(() => move(from, to))
    // Keep focus on the same button, now in the outcome's new position.
    document.getElementById(outcomeElementId(fieldId, button))?.focus()
    announce(`Outcome ${from + 1} moved to position ${to + 1}`)
  }

  async function removeOutcome(index: number) {
    const key = getValues(`outcomes.${index}.key`)
    const questions = getValues('questions')
    const pointing = questions
      .flatMap((question) => question.options)
      .filter((option) => option.outcomeKey === key)

    if (pointing.length > 0) {
      const confirmed = await confirm({
        title: `Remove outcome ${index + 1}?`,
        body:
          pointing.length === 1
            ? '1 answer points to this outcome and will need a new one.'
            : `${pointing.length} answers point to this outcome and will need a new one.`,
        confirmLabel: 'Remove outcome',
      })
      if (!confirmed) return
    }

    // Answers that pointed here now need a new outcome, which validation will ask for.
    questions.forEach((question, q) =>
      question.options.forEach((option, o) => {
        if (option.outcomeKey === key) setValue(`questions.${q}.options.${o}.outcomeKey`, '')
      }),
    )

    const next = fields[index + 1] ?? fields[index - 1]
    flushSync(() => remove(index))
    announce(`Outcome ${index + 1} removed`)
    if (next) document.getElementById(outcomeElementId(next.id, 'legend'))?.focus()
  }

  return (
    <>
      <p>Each answer in your questions will lead to one of these outcomes.</p>
      <FieldError id="outcomes-root-error" message={rootError} />

      {fields.map((field, index) => {
        // "No answer leads to this outcome yet" is stored on the hidden key; show it by the name.
        const nameError =
          formState.errors.outcomes?.[index]?.title?.message ??
          formState.errors.outcomes?.[index]?.key?.message
        const descriptionError = formState.errors.outcomes?.[index]?.description?.message
        const nameName = `outcomes.${index}.title` as const
        const descriptionName = `outcomes.${index}.description` as const
        const isFirst = index === 0
        const isLast = index === fields.length - 1

        return (
          <fieldset key={field.id} className="border padding margin-bottom">
            <legend id={outcomeElementId(field.id, 'legend')} tabIndex={-1}>
              Outcome {index + 1}
            </legend>
            <div className="margin-bottom">
              <label htmlFor={fieldDomId(nameName)}>Outcome {index + 1} name</label>
              <input type="text" {...fieldProps(nameName, nameError)} {...register(nameName)} />
              <FieldError id={`${fieldDomId(nameName)}-error`} message={nameError} />
            </div>
            <div className="margin-bottom">
              <label htmlFor={fieldDomId(descriptionName)}>
                Outcome {index + 1} description (optional)
              </label>
              <textarea
                rows={2}
                {...fieldProps(descriptionName, descriptionError)}
                {...register(descriptionName)}
              />
              <FieldError id={`${fieldDomId(descriptionName)}-error`} message={descriptionError} />
            </div>
            {/* aria-disabled, not disabled, so a button never loses focus after a move. */}
            <button
              id={outcomeElementId(field.id, 'up')}
              type="button"
              className="btn"
              aria-disabled={isFirst}
              onClick={() => !isFirst && moveOutcome(index, index - 1, 'up')}
            >
              Move up<span className="sr-only">: outcome {index + 1}</span>
            </button>{' '}
            <button
              id={outcomeElementId(field.id, 'down')}
              type="button"
              className="btn"
              aria-disabled={isLast}
              onClick={() => !isLast && moveOutcome(index, index + 1, 'down')}
            >
              Move down<span className="sr-only">: outcome {index + 1}</span>
            </button>{' '}
            <button
              type="button"
              className="btn"
              disabled={fields.length <= QUIZ_LIMITS.outcomesMin}
              onClick={() => void removeOutcome(index)}
            >
              Remove <span className="sr-only">outcome {index + 1}</span>
            </button>
          </fieldset>
        )
      })}

      <button
        id={ADD_OUTCOME_ID}
        type="button"
        className="btn"
        disabled={fields.length >= QUIZ_LIMITS.outcomesMax}
        onClick={() => append(emptyOutcome(), { focusName: `outcomes.${fields.length}.title` })}
      >
        Add outcome
      </button>

      {dialog}
    </>
  )
}
