import { Controller, useFormContext, useWatch } from 'react-hook-form'
import type { QuestionType, QuizFormInput, QuizFormValues, QuizKind } from '../../schemas/quiz'
import { PillGroup } from '../ui/PillGroup'
import { FieldError, fieldDomId, fieldProps } from './FieldError'

const POINTS_OPTIONS = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
] as const

type AnswerListProps = {
  questionIndex: number
  questionType: QuestionType
  kind: QuizKind
  // The field array's stable IDs for this question's answers, in order.
  answerIds: string[]
}

export function AnswerList({ questionIndex: q, questionType, kind, answerIds }: AnswerListProps) {
  const { register, formState, control } = useFormContext<QuizFormInput, unknown, QuizFormValues>()
  // The outcome choices come straight from the form's current outcomes, never a copy.
  const outcomes = useWatch<QuizFormInput, 'outcomes'>({ name: 'outcomes' })
  const questionErrors = formState.errors.questions?.[q]
  const isTrueFalse = questionType === 'true_false'
  // The error summary links to the first correct-answer control.
  const correctId = fieldDomId(`questions.${q}.correctOption`)

  if (kind === 'personality') {
    // One row per answer under Answer / Leads to / Points. The headings are only visual:
    // every control has its own full label ("Answer 2 leads to"), which is shown on narrow
    // screens, where the rows stack (specs/07-ui-redesign.md, P6.5).
    return (
      <fieldset>
        <legend>Answers to question {q + 1}</legend>
        <div className="answer-table">
          <div className="answer-table-head" aria-hidden="true">
            <span>Answer</span>
            <span>Leads to</span>
            <span>Points</span>
          </div>
          {answerIds.map((answerId, a) => {
            const n = a + 1
            const answerErrors = questionErrors?.options?.[a]
            const labelError = answerErrors?.label?.message
            const outcomeError = answerErrors?.outcomeKey?.message
            const labelName = `questions.${q}.options.${a}.label` as const
            const outcomeName = `questions.${q}.options.${a}.outcomeKey` as const
            const pointsName = `questions.${q}.options.${a}.points` as const

            return (
              <div key={answerId} className="answer-row">
                <div className="answer-cell">
                  <label className="cell-label" htmlFor={fieldDomId(labelName)}>
                    Answer {n} text
                  </label>
                  <input
                    type="text"
                    {...fieldProps(labelName, labelError)}
                    {...register(labelName)}
                  />
                  <FieldError id={`${fieldDomId(labelName)}-error`} message={labelError} />
                </div>
                <div className="answer-cell">
                  <label className="cell-label" htmlFor={fieldDomId(outcomeName)}>
                    {/* Ends in "leads to", like its column heading, so the name contains
                        the visible words (WCAG 2.5.3). */}
                    Answer {n} leads to
                  </label>
                  <select {...fieldProps(outcomeName, outcomeError)} {...register(outcomeName)}>
                    <option value="">Choose an outcome</option>
                    {outcomes.map((outcome, i) => (
                      <option key={outcome.key} value={outcome.key}>
                        {outcome.title.trim() || `Outcome ${i + 1}`}
                      </option>
                    ))}
                  </select>
                  <FieldError id={`${fieldDomId(outcomeName)}-error`} message={outcomeError} />
                </div>
                <div className="answer-cell">
                  {/* Three real radios drawn as pills; the form keeps '1', '2' or '3'. */}
                  <Controller
                    control={control}
                    name={pointsName}
                    render={({ field }) => (
                      <PillGroup
                        legend={`Answer ${n} points`}
                        name={fieldDomId(pointsName)}
                        options={[...POINTS_OPTIONS]}
                        value={field.value}
                        onChange={field.onChange}
                        hideLegend
                      />
                    )}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </fieldset>
    )
  }

  return (
    <fieldset>
      <legend>Answers to question {q + 1}</legend>

      {answerIds.map((answerId, a) => {
        const n = a + 1
        const labelError = questionErrors?.options?.[a]?.label?.message
        const labelName = `questions.${q}.options.${a}.label` as const

        return (
          <div key={answerId} className="margin-bottom">
            <label htmlFor={fieldDomId(labelName)}>Answer {n} text</label>
            {/* readOnly, not disabled: disabled fields are left out of the form's values. */}
            <input
              type="text"
              readOnly={isTrueFalse}
              {...fieldProps(labelName, labelError)}
              {...register(labelName)}
            />
            <FieldError id={`${fieldDomId(labelName)}-error`} message={labelError} />

            {questionType !== 'multi_select' && (
              <label>
                <input
                  type="radio"
                  value={String(a)}
                  id={a === 0 ? correctId : undefined}
                  {...register(`questions.${q}.correctOption`)}
                />{' '}
                Answer {n} is correct
              </label>
            )}

            {questionType === 'multi_select' && (
              <label>
                <input
                  type="checkbox"
                  id={a === 0 ? correctId : undefined}
                  {...register(`questions.${q}.options.${a}.isCorrect`)}
                />{' '}
                Answer {n} is correct
              </label>
            )}
          </div>
        )
      })}
    </fieldset>
  )
}
