import { useId, useRef, type ReactNode, type RefObject } from 'react'
import type { ContrastPref, TextSize, Theme } from '../schemas/settings'
import { useSession } from '../stores/authStore'
import { useSettingsStore } from '../stores/settingsStore'
import { DeleteAccountDialog, openDeleteAccountDialog } from './DeleteAccountDialog'
import { PillGroup } from './ui/PillGroup'

type Choice<T extends string> = { value: T; label: ReactNode }

const themeChoices: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

// Each text size option is shown at its own size, relative to the others.
const textSizeChoices: Choice<TextSize>[] = [
  { value: 'default', label: 'Default' },
  { value: 'large', label: <span className="text-size-large">Large</span> },
  { value: 'larger', label: <span className="text-size-larger">Larger</span> },
  { value: 'largest', label: <span className="text-size-largest">Largest</span> },
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
        {/* Real radios, drawn as small previews of each theme. */}
        <fieldset>
          <legend>Theme</legend>
          <div className="theme-tiles">
            {themeChoices.map((choice) => (
              <label key={choice.value}>
                <input
                  type="radio"
                  name="theme"
                  value={choice.value}
                  checked={settings.theme === choice.value}
                  onChange={() => settings.setTheme(choice.value)}
                />
                <span className="theme-preview" data-preview={choice.value} aria-hidden="true" />
                {choice.label}
              </label>
            ))}
          </div>
        </fieldset>
        <PillGroup
          legend="Text size"
          name="text-size"
          options={textSizeChoices}
          value={settings.textSize}
          onChange={settings.setTextSize}
        />
        <PillGroup
          legend="High contrast"
          name="high-contrast"
          options={contrastChoices}
          value={settings.highContrast}
          onChange={settings.setHighContrast}
        />
        <fieldset>
          <legend>Font</legend>
          {/* Still a checkbox, drawn and announced as an on/off switch. */}
          <label>
            <input
              type="checkbox"
              role="switch"
              className="font-switch"
              checked={settings.dyslexiaFont}
              onChange={(event) => settings.setDyslexiaFont(event.target.checked)}
            />
            Use Lexend, a font designed for easier reading
          </label>
        </fieldset>

        {session && (
          <section className="settings-account" aria-labelledby={accountHeadingId}>
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
