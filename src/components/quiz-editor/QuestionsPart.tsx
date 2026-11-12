import { flushSync } from 'react-dom'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { emptyQuestion, type QuizFormInput, type QuizFormValues } from '../../schemas/quiz'
import { QUIZ_LIMITS } from '../../schemas/quizLimits'
import { announce } from '../../stores/announcerStore'
import { useConfirmDialog } from '../ConfirmDialog'
import { FieldError } from './FieldError'
import { QuestionEditor, questionElementId } from './QuestionEditor'
import { SuggestedTimeField } from './SuggestedTimeField'

export const ADD_QUESTION_ID = 'add-question'

export function QuestionsPart() {
  const { control, getValues, formState } = useFormContext<QuizFormInput, unknown, QuizFormValues>()
  const { fields, append, remove, move } = useFieldArray({ control, name: 'questions' })
  const kind = useWatch<QuizFormInput, 'kind'>({ name: 'kind' })
  const { confirm, dialog } = useConfirmDialog()
  const rootError = formState.errors.questions?.root?.message

  function moveQuestion(from: number, to: number, button: 'up' | 'down') {
    if (to < 0 || to >= fields.length) return
    const fieldId = fields[from].id
    flushSync(() => move(from, to))
    // Keep focus on the same button, now in the question's new position.
    document.getElementById(questionElementId(fieldId, button))?.focus()
    announce(`Question ${from + 1} moved to position ${to + 1}`)
  }

  async function removeQuestion(index: number) {
    const question = getValues(`questions.${index}`)
    const hasText =
      question.prompt.trim() !== '' || question.options.some((option) => option.label.trim() !== '')
    if (hasText) {
      const confirmed = await confirm({
        title: `Remove question ${index + 1}?`,
        body: 'Its text and answers will be removed.',
        confirmLabel: 'Remove question',
      })
      if (!confirmed) return
    }

    const next = fields[index + 1] ?? fields[index - 1]
    flushSync(() => remove(index))
    announce(`Question ${index + 1} removed`)
    if (next) document.getElementById(questionElementId(next.id, 'legend'))?.focus()
  }

  function addQuestion() {
    // Focus the new question's type field, or its text for personality quizzes.
    const focusName =
      kind === 'trivia'
        ? (`questions.${fields.length}.type` as const)
        : (`questions.${fields.length}.prompt` as const)
    append(emptyQuestion(), { focusName })
  }

  return (
    <>
      <FieldError id="questions-root-error" message={rootError} />

      {fields.map((field, index) => (
        <QuestionEditor
          key={field.id}
          index={index}
          fieldId={field.id}
          total={fields.length}
          kind={kind}
          confirm={confirm}
          onMove={moveQuestion}
          onRemove={(i) => void removeQuestion(i)}
        />
      ))}

      <p>
        <button
          id={ADD_QUESTION_ID}
          type="button"
          className="btn"
          disabled={fields.length >= QUIZ_LIMITS.questionsMax}
          onClick={addQuestion}
        >
          Add question
        </button>
      </p>

      <SuggestedTimeField />
      {dialog}
    </>
  )
}
