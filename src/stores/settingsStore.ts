import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { applySettings } from '../lib/applySettings'
import { saveSettingsToAccount } from '../lib/settingsSync'
import {
  DEFAULT_SETTINGS,
  storedSettingsSchema,
  type ContrastPref,
  type Settings,
  type TextSize,
  type Theme,
} from '../schemas/settings'

type SettingsState = Settings & {
  setTheme: (theme: Theme) => void
  setTextSize: (textSize: TextSize) => void
  setHighContrast: (highContrast: ContrastPref) => void
  setDyslexiaFont: (dyslexiaFont: boolean) => void
}

// Just the four values, without the setters.
export function pickSettings(state: Settings): Settings {
  const { theme, textSize, highContrast, dyslexiaFont } = state
  return { theme, textSize, highContrast, dyslexiaFont }
}

// The only place settings live. Saved in local storage under "settings" for everyone.
// The setters are user changes, so only they save to a member's account; settingsSync
// writes the account's values with setState, so those never bounce back.
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get): SettingsState => {
      function change(next: Partial<Settings>) {
        set(next)
        void saveSettingsToAccount(pickSettings(get()))
      }
      return {
        ...DEFAULT_SETTINGS,
        setTheme: (theme) => change({ theme }),
        setTextSize: (textSize) => change({ textSize }),
        setHighContrast: (highContrast) => change({ highContrast }),
        setDyslexiaFont: (dyslexiaFont) => change({ dyslexiaFont }),
      }
    },
    {
      name: 'settings',
      partialize: pickSettings,
      // Invalid stored values fall back to the defaults.
      merge: (persisted, current) => ({ ...current, ...storedSettingsSchema.parse(persisted) }),
    },
  ),
)

// Apply now, and after every change, wherever it comes from. Set up once, when this
// module loads, like the auth store's listener.
applySettings(pickSettings(useSettingsStore.getState()))
const unsubscribe = useSettingsStore.subscribe((state) => applySettings(pickSettings(state)))

// Another open tab changed the settings: pick them up here too.
function handleStorage(event: StorageEvent) {
  if (event.key === 'settings') void useSettingsStore.persist.rehydrate()
}
window.addEventListener('storage', handleStorage)

// Stop hot reloads in development from stacking up listeners.
import.meta.hot?.dispose(() => {
  unsubscribe()
  window.removeEventListener('storage', handleStorage)
})
