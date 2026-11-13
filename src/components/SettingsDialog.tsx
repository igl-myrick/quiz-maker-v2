import { useId, useRef, type RefObject } from 'react'
import type { ContrastPref, TextSize, Theme } from '../schemas/settings'
import { useSession } from '../stores/authStore'
import { useSettingsStore } from '../stores/settingsStore'
import { DeleteAccountDialog, openDeleteAccountDialog } from './DeleteAccountDialog'

type Choice<T extends string> = { value: T; label: string; className?: string }

type RadioGroupProps<T extends string> = {
  legend: string
  name: string
  choices: Choice<T>[]
  value: T
  onChange: (value: T) => void
}

// One setting as real radio buttons in a fieldset. Controlled by the settings store.
function RadioGroup<T extends string>({
  legend,
  name,
  choices,
  value,
  onChange,
}: RadioGroupProps<T>) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      {choices.map((choice) => (
        <label key={choice.value} className={`settings-choice ${choice.className ?? ''}`}>
          <input
            type="radio"
            name={name}
            value={choice.value}
            checked={value === choice.value}
            onChange={() => onChange(choice.value)}
          />
          {choice.label}
        </label>
      ))}
    </fieldset>
  )
}

const themeChoices: Choice<Theme>[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

const textSizeChoices: Choice<TextSize>[] = [
  { value: 'default', label: 'Default' },
  { value: 'large', label: 'Large', className: 'text-size-large' },
  { value: 'larger', label: 'Larger', className: 'text-size-larger' },
  { value: 'largest', label: 'Largest', className: 'text-size-largest' },
]

const contrastChoices: Choice<ContrastPref>[] = [
  { value: 'system', label: 'Follow system' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
]

// Opens the settings popup with focus on the chosen theme.
export function openSettingsDialog(dialog: HTMLDialogElement) {
  dialog.showModal()
  dialog.querySelector<HTMLInputElement>('input[name="theme"]:checked')?.focus()
}

type SettingsDialogProps = {
  dialogRef: RefObject<HTMLDialogElement | null>
}

// Every change applies at once (there's no Save button), straight from the store.
export function SettingsDialog({ dialogRef }: SettingsDialogProps) {
  const settings = useSettingsStore()
  const session = useSession()
  const deleteDialogRef = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  const accountHeadingId = useId()

  return (
    <dialog ref={dialogRef} className="settings-dialog" aria-labelledby={headingId}>
      <div className="dialog-header">
        <h2 id={headingId}>Settings</h2>
        <button
          type="button"
          className="dialog-close"
          aria-label="Close"
          onClick={() => dialogRef.current?.close()}
        >
          ×
        </button>
      </div>

      <div className="dialog-body">
        <RadioGroup
          legend="Theme"
          name="theme"
          choices={themeChoices}
          value={settings.theme}
          onChange={settings.setTheme}
        />
        <RadioGroup
          legend="Text size"
          name="text-size"
          choices={textSizeChoices}
          value={settings.textSize}
          onChange={settings.setTextSize}
        />
        <RadioGroup
          legend="High contrast"
          name="high-contrast"
          choices={contrastChoices}
          value={settings.highContrast}
          onChange={settings.setHighContrast}
        />
        <fieldset>
          <legend>Font</legend>
          <label className="settings-choice">
            <input
              type="checkbox"
              checked={settings.dyslexiaFont}
              onChange={(event) => settings.setDyslexiaFont(event.target.checked)}
            />
            Use Lexend, a font designed for easier reading
          </label>
        </fieldset>

        {session && (
          <section aria-labelledby={accountHeadingId}>
            <h3 id={accountHeadingId}>Account</h3>
            <button
              type="button"
              className="btn btn-red"
              onClick={() => {
                if (deleteDialogRef.current) openDeleteAccountDialog(deleteDialogRef.current)
              }}
            >
              Delete my account
            </button>
            <DeleteAccountDialog dialogRef={deleteDialogRef} settingsDialogRef={dialogRef} />
          </section>
        )}
      </div>
    </dialog>
  )
}
