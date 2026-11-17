import type { QuizKind } from '../../schemas/quiz'

// The small coloured "TRIVIA" / "PERSONALITY" tag on cards and popups. The words are in
// normal case and shown uppercase by CSS, so screen readers say the word, not the letters.
export function KindChip({ kind }: { kind: QuizKind }) {
  return (
    <span className="kind-chip" data-chip-kind={kind}>
      {kind === 'trivia' ? 'Trivia' : 'Personality'}
    </span>
  )
}
