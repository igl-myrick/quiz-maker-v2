type StepPillsProps = {
  steps: string[]
  // 1-based, like the editor's "Part N of M" heading.
  current: number
}

// The quiz editor's row of step pills. Decorative only: the "Part N of M: …" heading
// next to it is what screen readers use.
export function StepPills({ steps, current }: StepPillsProps) {
  return (
    <ol className="step-pills" aria-hidden="true">
      {steps.map((step, index) => {
        const number = index + 1
        const state = number < current ? 'done' : number === current ? 'current' : 'todo'
        return (
          <li key={step} data-state={state}>
            {state === 'done' ? '✓' : number} · {step}
          </li>
        )
      })}
    </ol>
  )
}
