import type { ReactNode } from 'react'

type PillOption<T extends string> = { value: T; label: ReactNode }

type PillGroupProps<T extends string> = {
  legend: string
  name: string
  options: PillOption<T>[]
  value: T
  onChange: (value: T) => void
  // Keeps the legend for screen readers but hides it on screen, for when a visible
  // heading already says the same thing (the editor's Points column).
  hideLegend?: boolean
}

// A row of joined pills that are real radio buttons, so arrow keys and screen readers
// treat it as an ordinary radio group. Fully controlled by value and onChange.
export function PillGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  hideLegend,
}: PillGroupProps<T>) {
  return (
    <fieldset className="pill-group">
      <legend className={hideLegend ? 'sr-only' : undefined}>{legend}</legend>
      <div className="pill-group-options">
        {options.map((option) => (
          <label key={option.value}>
            <input
              className="sr-only"
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
