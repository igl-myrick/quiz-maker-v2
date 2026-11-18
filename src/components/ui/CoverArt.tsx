const ink = 'var(--qm-art-ink)'

const columns = [105, 152, 199, 246, 293, 340]
const rows = [50, 97, 144]
// The chosen answer in each row of the grid.
const marks = [
  [199, 50],
  [105, 97],
  [293, 144],
]
// The checkbox column on the left; the first and last are ticked.
const checkboxes = [
  { y: 34, ticked: true },
  { y: 82, ticked: false },
  { y: 130, ticked: true },
]

// The homepage cover drawing: a checkbox column, an answer grid in the trivia colour
// and two result blocks. Decorative, drawn with theme colours, and scales to its box.
export function CoverArt() {
  return (
    <svg className="cover-art" aria-hidden="true" focusable="false" viewBox="0 0 440 270">
      {checkboxes.map(({ y, ticked }) => (
        <g key={y}>
          <rect
            x="4"
            y={y}
            width="22"
            height="22"
            rx="5"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          {ticked && <rect x="10" y={y + 6} width="10" height="10" rx="2" fill="currentColor" />}
        </g>
      ))}

      <rect x="60" y="0" width="360" height="190" rx="18" fill="var(--qm-trivia)" />
      <g fill="none" stroke={ink} strokeWidth="2.5">
        {rows.map((cy) =>
          columns.map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="12" />),
        )}
      </g>
      <g fill={ink}>
        {marks.map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="6" />
        ))}
      </g>

      <rect x="60" y="208" width="170" height="58" rx="14" fill="currentColor" opacity="0.65" />
      <rect x="248" y="208" width="172" height="58" rx="14" fill="currentColor" opacity="0.2" />
    </svg>
  )
}
