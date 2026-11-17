import type { ReactNode } from 'react'
import type { Result } from '../../schemas/result'
import { StripArt } from '../ui/StripArt'

type PersonalityResultProps = {
  result: Result
  // Copy link and Find another quiz, shown inside the outcome card.
  actions: ReactNode
}

// The winning outcome only, as stored at submission. Nothing is recalculated here.
export function PersonalityResult({ result, actions }: PersonalityResultProps) {
  const outcome = result.winning_outcome

  return (
    <div className="outcome-card">
      <div className="outcome-strip">
        <StripArt kind="personality" />
      </div>
      <div className="outcome-body">
        <h1 tabIndex={-1}>{outcome ? `You're ${outcome.title}` : result.quiz_title}</h1>
        {outcome?.description && <p>{outcome.description}</p>}
        {outcome && <h2>{result.quiz_title}</h2>}
        <div className="result-actions">{actions}</div>
      </div>
    </div>
  )
}
