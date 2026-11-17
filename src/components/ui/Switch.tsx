import type { ReactNode } from 'react'

type SwitchProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  // The visible text next to the track.
  label: ReactNode
  // The accessible name, when it should differ from the visible text (the timer is
  // named "Timer" while its text says "Timer on" or "Timer off").
  ariaLabel?: string
}

// An on/off button drawn as a track and knob.
export function Switch({ checked, onChange, label, ariaLabel }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      className="switch"
      onClick={() => onChange(!checked)}
    >
      <span className="switch-track" aria-hidden="true">
        <span className="switch-knob" />
      </span>
      {label}
    </button>
  )
}
