import { useFormContext, useWatch } from 'react-hook-form'
import {
  emptyOption,
  emptyOutcome,
  type QuizFormInput,
  type QuizFormValues,
  type QuizKind,
} from '../../schemas/quiz'
import { QUIZ_LIMITS } from '../../schemas/quizLimits'
import { useConfirmDialog } from '../ConfirmDialog'
import { CharacterCount } from './CharacterCount'
import { FieldError, fieldDomId, fieldProps } from './FieldError'

// Whether switching kind would throw away kind-specific work.
function hasKindData(values: QuizFormInput) {
  if (values.kind === 'trivia') {
    return values.questions.some(
      (question) =>
        question.correctOption !== '' || question.options.some((option) => option.isCorrect),
    )
  }
  return (
    values.outcomes.some(
      (outcome) => outcome.title.trim() !== '' || outcome.description.trim() !== '',
    ) ||
    values.questions.some((question) =>
      question.options.some((option) => option.outcomeKey !== '' || option.points !== '1'),
    )
  )
}

type BasicsPartProps = {
  isEditing: boolean
}

export function BasicsPart({ isEditing }: BasicsPartProps) {
  const { register, getValues, setValue, formState } = useFormContext<
    QuizFormInput,
    unknown,
    QuizFormValues
  >()
  const kind = useWatch<QuizFormInput, 'kind'>({ name: 'kind' })
  const { confirm, dialog } = useConfirmDialog()

  const titleError = formState.errors.title?.message
  const descriptionError = formState.errors.description?.message

  // Rebuild the whole questions list for the new kind, so nothing from the old kind
  // stays behind. Titles, question text and answer text are kept.
  function applyKindChange(next: QuizKind) {
    const values = getValues()
    setValue('kind', next, { shouldDirty: true })
    setValue('outcomes', next === 'personality' ? [emptyOutcome(), emptyOutcome()] : [], {
      shouldDirty: true,
    })
    setValue(
      'questions',
      values.questions.map((question) => ({
        type: 'single_choice' as const,
        prompt: question.prompt,
        correctOption: '',
        options: question.options.map((option) => emptyOption(option.label)),
      })),
      { shouldDirty: true },
    )
  }

  async function requestKindChange(next: QuizKind) {
    if (next === kind) return
    if (hasKindData(getValues())) {
      const confirmed = await confirm(
        next === 'personality'
          ? {
              title: 'Switch to Personality?',
              body: 'Correct-answer markings will be cleared, and every question will become single-choice.',
              confirmLabel: 'Switch to Personality',
            }
          : {
              title: 'Switch to Trivia?',
              body: "Your outcomes and each answer's outcome and points will be removed.",
              confirmLabel: 'Switch to Trivia',
            },
      )
      if (!confirmed) return
    }
    applyKindChange(next)
  }

  return (
    <>
      <div className="margin-bottom">
        <label htmlFor={fieldDomId('title')}>Title</label>
        <input type="text" {...fieldProps('title', titleError)} {...register('title')} />
        <CharacterCount name="title" max={QUIZ_LIMITS.titleMax} />
        <FieldError id={`${fieldDomId('title')}-error`} message={titleError} />
      </div>

      <div className="margin-bottom">
        <label htmlFor={fieldDomId('description')}>Description (optional)</label>
        <textarea
          rows={3}
          {...fieldProps('description', descriptionError)}
          {...register('description')}
        />
        <CharacterCount name="description" max={QUIZ_LIMITS.descriptionMax} />
        <FieldError id={`${fieldDomId('description')}-error`} message={descriptionError} />
      </div>

      {isEditing ? (
        <p>
          Kind: {kind === 'trivia' ? 'Trivia' : 'Personality'}. This can&apos;t be changed after
          publishing.
        </p>
      ) : (
        <fieldset>
          <legend>Kind</legend>
          <label>
            <input
              type="radio"
              name="kind"
              value="trivia"
              checked={kind === 'trivia'}
              onChange={() => void requestKindChange('trivia')}
            />{' '}
            Trivia: right and wrong answers
          </label>
          <label>
            <input
              type="radio"
              name="kind"
              value="personality"
              checked={kind === 'personality'}
              onChange={() => void requestKindChange('personality')}
            />{' '}
            Personality: answers lead to an outcome
          </label>
        </fieldset>
      )}

      {dialog}
    </>
  )
}
