// A decorative drawing of a quiz in progress: a question, three answers with one chosen,
// and a progress bar. Colours come from the theme so it works in light and dark mode.
export function QuizIllustration() {
  const accent = { fill: 'var(--ply-btn-default-bg)' }
  const muted = { fill: 'currentColor', opacity: 0.15 }
  const line = { fill: 'currentColor', opacity: 0.35 }

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 320 220"
      width="320"
      height="220"
      style={{ maxWidth: '100%', height: 'auto' }}
    >
      {/* card */}
      <rect x="8" y="8" width="304" height="204" rx="16" style={muted} />

      {/* progress bar, about half done */}
      <rect x="32" y="28" width="256" height="8" rx="4" style={muted} />
      <rect x="32" y="28" width="128" height="8" rx="4" style={accent} />

      {/* question text */}
      <rect x="32" y="56" width="200" height="12" rx="6" style={line} />
      <rect x="32" y="76" width="140" height="12" rx="6" style={line} />

      {/* answers: the second one is chosen */}
      <circle cx="44" cy="118" r="9" fill="none" stroke="currentColor" strokeWidth="3" />
      <rect x="64" y="112" width="150" height="12" rx="6" style={line} />

      <circle cx="44" cy="150" r="9" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="44" cy="150" r="5" style={accent} />
      <rect x="64" y="144" width="120" height="12" rx="6" style={line} />

      <circle cx="44" cy="182" r="9" fill="none" stroke="currentColor" strokeWidth="3" />
      <rect x="64" y="176" width="170" height="12" rx="6" style={line} />
    </svg>
  )
}
