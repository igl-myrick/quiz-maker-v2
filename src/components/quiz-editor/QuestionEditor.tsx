import { useId, type ChangeEvent } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import {
  QUESTION_TYPES,
  emptyOption,
  type QuestionType,
  type QuizFormInput,
  type QuizFormValues,
  type QuizKind,
} from '../../schemas/quiz'
import { QUIZ_LIMITS } from '../../schemas/quizLimits'
import type { ConfirmOptions } from '../ConfirmDialog'
import { AnswerList } from './AnswerList'
import { FieldError, fieldDomId, fieldProps } from './FieldError'

const TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: 'Single-choice',
  true_false: 'True/false',
  multi_select: 'Multi-select (choose all that apply)',
}

function isQuestionType(value: string): value is QuestionType {
  return QUESTION_TYPES.some((type) => type === value)
}

export function questionElementId(fieldId: string, what: 'legend' | 'up' | 'down') {
  return `question-${fieldId}-${what}`
}

const ANSWER_COUNTS = Array.from(
  { length: QUIZ_LIMITS.answersMax - QUIZ_LIMITS.answersMin + 1 },
  (_, i) => QUIZ_LIMITS.answersMin + i,
)

type QuestionEditorProps = {
  index: number
  fieldId: string
  total: number
  kind: QuizKind
  confirm: (options: ConfirmOptions) => Promise<boolean>
  onMove: (from: number, to: number, button: 'up' | 'down') => void
  onRemove: (index: number) => void
}

export function QuestionEditor({
  index: q,
  fieldId,
  total,
  kind,
  confirm,
  onMove,
  onRemove,
}: QuestionEditorProps) {
  const { control, register, getValues, setValue, formState } = useFormContext<
    QuizFormInput,
    unknown,
    QuizFormValues
  >()
  const {
    fields: answers,
    replace,
    append,
    remove,
  } = useFieldArray({
    control,
    name: `questions.${q}.options`,
  })
  const type = useWatch<QuizFormInput, `questions.${number}.type`>({ name: `questions.${q}.type` })
  const baseId = useId()
  const errors = formState.errors.questions?.[q]
  const promptError = errors?.prompt?.message
  const typeError = errors?.type?.message
  const correctError = errors?.correctOption?.message
  const answersError = errors?.options?.root?.message ?? errors?.options?.message

  // Runs after the select's new value is stored. `type` here is still the old value.
  function handleTypeChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value
    if (!isQuestionType(next) || next === type) return
    setValue(`questions.${q}.correctOption`, '')

    if (next === 'true_false') {
      replace([emptyOption('True'), emptyOption('False')])
    } else if (type === 'true_false') {
      replace([emptyOption(), emptyOption()])
    } else {
      // Between single-choice and multi-select: keep the text, clear the correct markings.
      replace(getValues(`questions.${q}.options`).map((option) => emptyOption(option.label)))
    }
  }

  async function handleAnswerCountChange(event: ChangeEvent<HTMLSelectElement>) {
    const count = Number(event.target.value)
    if (count > answers.length) {
      append(
        Array.from({ length: count - answers.length }, () => emptyOption()),
        { shouldFocus: false },
      )
      return
    }

    const dropped = getValues(`questions.${q}.options`).slice(count)
    if (dropped.some((option) => option.label.trim() !== '')) {
      const removing = answers.length - count
      const confirmed = await confirm({
        title: `Remove ${removing === 1 ? '1 answer' : `${removing} answers`}?`,
        body: 'The last answers in this question have text, which will be removed.',
        confirmLabel: 'Remove answers',
      })
      if (!confirmed) return
    }
    if (Number(getValues(`questions.${q}.correctOption`)) >= count) {
      setValue(`questions.${q}.correctOption`, '')
    }
    remove(Array.from({ length: answers.length - count }, (_, i) => count + i))
  }

  const isFirst = q === 0
  const isLast = q === total - 1
  const typeName = `questions.${q}.type` as const
  const promptName = `questions.${q}.prompt` as const
  const countId = `${baseId}-count`

  return (
    <fieldset className="border padding margin-bottom">
      <legend id={questionElementId(fieldId, 'legend')} tabIndex={-1}>
        Question {q + 1}
      </legend>
      {kind === 'trivia' ? (
        <div className="margin-bottom">
          <label htmlFor={fieldDomId(typeName)}>Question {q + 1} type</label>
          <select
            {...fieldProps(typeName, typeError)}
            {...register(typeName, { onChange: handleTypeChange })}
          >
            {QUESTION_TYPES.map((value) => (
              <option key={value} value={value}>
                {TYPE_LABELS[value]}
              </option>
            ))}
          </select>
          <FieldError id={`${fieldDomId(typeName)}-error`} message={typeError} />
        </div>
      ) : (
        <div className="margin-bottom">
          <p>Type: single-choice</p>
          <FieldError id={`${fieldDomId(typeName)}-error`} message={typeError} />
        </div>
      )}
      <div className="margin-bottom">
        <label htmlFor={fieldDomId(promptName)}>Question {q + 1} text</label>
        <input type="text" {...fieldProps(promptName, promptError)} {...register(promptName)} />
        <FieldError id={`${fieldDomId(promptName)}-error`} message={promptError} />
      </div>
      {type !== 'true_false' && (
        <div className="margin-bottom">
          <label htmlFor={countId}>Number of answers for question {q + 1}</label>
          <select
            id={countId}
            value={answers.length}
            onChange={(event) => void handleAnswerCountChange(event)}
          >
            {ANSWER_COUNTS.map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </div>
      )}
      <AnswerList
        questionIndex={q}
        questionType={type}
        kind={kind}
        answerIds={answers.map((answer) => answer.id)}
      />
      <FieldError
        id={`${fieldDomId(`questions.${q}.correctOption`)}-error`}
        message={correctError}
      />
      <FieldError id={`${baseId}-answers-error`} message={answersError} />
      {/* aria-disabled, not disabled, so a button never loses focus after a move. */}
      <button
        id={questionElementId(fieldId, 'up')}
        type="button"
        className="btn"
        aria-disabled={isFirst}
        onClick={() => !isFirst && onMove(q, q - 1, 'up')}
      >
        Move up<span className="sr-only">: question {q + 1}</span>
      </button>{' '}
      <button
        id={questionElementId(fieldId, 'down')}
        type="button"
        className="btn"
        aria-disabled={isLast}
        onClick={() => !isLast && onMove(q, q + 1, 'down')}
      >
        Move down<span className="sr-only">: question {q + 1}</span>
      </button>{' '}
      <button type="button" className="btn" disabled={total <= 1} onClick={() => onRemove(q)}>
        Remove <span className="sr-only">question {q + 1}</span>
      </button>
    </fieldset>
  )
}
