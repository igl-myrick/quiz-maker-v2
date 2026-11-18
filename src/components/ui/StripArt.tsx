import type { QuizKind } from '../../schemas/quiz'

const ink = 'var(--qm-art-ink)'

const columns = [12, 34, 56]
const rows = [50, 72, 94, 116, 138]
// The chosen answer in each row.
const marks = [
  [34, 50],
  [12, 72],
  [56, 94],
  [34, 116],
  [12, 138],
]

// The tall drawing down the side of the quiz details popup and dashboard result cards:
// a progress bar and two question lines, then an answer sheet. Trivia answers are
// circles, personality answers rounded squares. The caller paints the kind colour behind
// it. Decorative, drawn with theme colours.
export function StripArt({ kind }: { kind: QuizKind }) {
  const isTrivia = kind === 'trivia'

  return (
    <svg
      className="strip-art"
      data-art-kind={kind}
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 68 150"
    >
      <rect x="4" y="4" width="60" height="6" rx="3" fill={ink} opacity="0.25" />
      <rect x="4" y="4" width={isTrivia ? 34 : 22} height="6" rx="3" fill={ink} />
      <rect x="4" y="20" width="56" height="6" rx="3" fill={ink} opacity="0.55" />
      <rect x="4" y="31" width="38" height="6" rx="3" fill={ink} opacity="0.55" />

      <g fill="none" stroke={ink} strokeWidth="2">
        {rows.map((cy) =>
          columns.map((cx) =>
            isTrivia ? (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="7.5" />
            ) : (
              <rect key={`${cx}-${cy}`} x={cx - 7.5} y={cy - 7.5} width="15" height="15" rx="4" />
            ),
          ),
        )}
      </g>
      <g fill={ink}>
        {marks.map(([cx, cy]) =>
          isTrivia ? (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3.8" />
          ) : (
            <rect key={`${cx}-${cy}`} x={cx - 4} y={cy - 4} width="8" height="8" rx="1.5" />
          ),
        )}
      </g>
    </svg>
  )
}
