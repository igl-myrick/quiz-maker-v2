import { useWatch } from 'react-hook-form'
import { charCount, type QuizFormInput } from '../../schemas/quiz'

type CharacterCountProps = {
  name: 'title' | 'description'
  max: number
}

// "12/75" for sighted users. Screen readers only hear it near the limit (10 or fewer left).
export function CharacterCount({ name, max }: CharacterCountProps) {
  const value = useWatch<QuizFormInput, typeof name>({ name })
  const remaining = max - charCount(value.trim())

  return (
    <>
      <span className="form-desc" aria-hidden="true">
        {charCount(value.trim())}/{max}
      </span>
      <span className="sr-only" aria-live="polite">
        {remaining <= 10 ? `${Math.max(remaining, 0)} characters left` : ''}
      </span>
    </>
  )
}
