import { useFormContext, useWatch } from 'react-hook-form'
import type { QuestionType, QuizFormInput, QuizFormValues, QuizKind } from '../../schemas/quiz'
import { FieldError, fieldDomId, fieldProps } from './FieldError'

type AnswerListProps = {
  questionIndex: number
  questionType: QuestionType
  kind: QuizKind
  // The field array's stable IDs for this question's answers, in order.
  answerIds: string[]
}

export function AnswerList({ questionIndex: q, questionType, kind, answerIds }: AnswerListProps) {
  const { register, formState } = useFormContext<QuizFormInput, unknown, QuizFormValues>()
  // The outcome choices come straight from the form's current outcomes, never a copy.
  const outcomes = useWatch<QuizFormInput, 'outcomes'>({ name: 'outcomes' })
  const questionErrors = formState.errors.questions?.[q]
  const isTrueFalse = questionType === 'true_false'
  // The error summary links to the first correct-answer control.
  const correctId = fieldDomId(`questions.${q}.correctOption`)

  return (
    <fieldset>
      <legend>Answers to question {q + 1}</legend>

      {answerIds.map((answerId, a) => {
        const n = a + 1
        const answerErrors = questionErrors?.options?.[a]
        const labelError = answerErrors?.label?.message
        const outcomeError = answerErrors?.outcomeKey?.message
        const labelName = `questions.${q}.options.${a}.label` as const
        const outcomeName = `questions.${q}.options.${a}.outcomeKey` as const
        const pointsName = `questions.${q}.options.${a}.points` as const

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

            {kind === 'trivia' && questionType !== 'multi_select' && (
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

            {kind === 'trivia' && questionType === 'multi_select' && (
              <label>
                <input
                  type="checkbox"
                  id={a === 0 ? correctId : undefined}
                  {...register(`questions.${q}.options.${a}.isCorrect`)}
                />{' '}
                Answer {n} is correct
              </label>
            )}

            {kind === 'personality' && (
              <>
                <label htmlFor={fieldDomId(outcomeName)}>Answer {n} outcome</label>
                <select {...fieldProps(outcomeName, outcomeError)} {...register(outcomeName)}>
                  <option value="">Choose an outcome</option>
                  {outcomes.map((outcome, i) => (
                    <option key={outcome.key} value={outcome.key}>
                      {outcome.title.trim() || `Outcome ${i + 1}`}
                    </option>
                  ))}
                </select>
                <FieldError id={`${fieldDomId(outcomeName)}-error`} message={outcomeError} />

                <label htmlFor={fieldDomId(pointsName)}>Answer {n} points</label>
                <select id={fieldDomId(pointsName)} {...register(pointsName)}>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
              </>
            )}
          </div>
        )
      })}
    </fieldset>
  )
}
