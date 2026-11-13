import type { Result } from '../../schemas/result'

// The winning outcome only, as stored at submission. Nothing is recalculated here.
export function PersonalityResult({ result }: { result: Result }) {
  const outcome = result.winning_outcome

  return (
    <>
      <h1 tabIndex={-1}>{outcome ? `You're ${outcome.title}` : result.quiz_title}</h1>
      {outcome?.description && <p>{outcome.description}</p>}
      {outcome && <h2>{result.quiz_title}</h2>}
    </>
  )
}
