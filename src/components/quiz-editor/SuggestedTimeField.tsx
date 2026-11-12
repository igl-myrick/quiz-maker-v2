import { useFormContext, useWatch } from 'react-hook-form'
import type { QuizFormInput, QuizFormValues } from '../../schemas/quiz'
import { QUIZ_LIMITS } from '../../schemas/quizLimits'
import { FieldError, fieldDomId, fieldProps } from './FieldError'

export function SuggestedTimeField() {
  const { register, formState } = useFormContext<QuizFormInput, unknown, QuizFormValues>()
  const hasSuggestedTime = useWatch<QuizFormInput, 'hasSuggestedTime'>({ name: 'hasSuggestedTime' })
  const minutesError = formState.errors.suggestedMinutes?.message

  return (
    <fieldset className="margin-bottom">
      <legend>Suggested time</legend>
      <label>
        <input type="radio" value="no" {...register('hasSuggestedTime')} /> No suggested time
      </label>
      <label>
        <input type="radio" value="yes" {...register('hasSuggestedTime')} /> Suggested time
      </label>

      {hasSuggestedTime === 'yes' && (
        <div>
          <label htmlFor={fieldDomId('suggestedMinutes')}>Minutes</label>
          <input
            type="number"
            inputMode="numeric"
            min={QUIZ_LIMITS.minutesMin}
            max={QUIZ_LIMITS.minutesMax}
            step={1}
            {...fieldProps('suggestedMinutes', minutesError)}
            {...register('suggestedMinutes')}
          />
          <FieldError id={`${fieldDomId('suggestedMinutes')}-error`} message={minutesError} />
        </div>
      )}
    </fieldset>
  )
}
