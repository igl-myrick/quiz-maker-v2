import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveSettingsToAccount } from '../lib/settingsSync'
import { DEFAULT_SETTINGS } from '../schemas/settings'

// settingsSync is mocked in vitest.setup.ts, so saveSettingsToAccount is a spy here.

// The store reads local storage when its module loads, so each test loads it fresh.
async function loadStore(saved?: unknown) {
  if (saved !== undefined) localStorage.setItem('settings', JSON.stringify(saved))
  vi.resetModules()
  const { useSettingsStore, pickSettings } = await import('./settingsStore')
  const { saveSettingsToAccount: save } = await import('../lib/settingsSync')
  return { useSettingsStore, pickSettings, save: vi.mocked(save) }
}

describe('settingsStore', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(saveSettingsToAccount).mockClear()
  })

  it('starts with the defaults and applies them to <html>', async () => {
    const { useSettingsStore, pickSettings } = await loadStore()
    expect(pickSettings(useSettingsStore.getState())).toEqual(DEFAULT_SETTINGS)
    expect(document.documentElement).toHaveAttribute('data-text-size', 'default')
    expect(document.documentElement).not.toHaveAttribute('data-theme')
  })

  it('loads saved settings', async () => {
    const saved = { theme: 'dark', textSize: 'larger', highContrast: 'on', dyslexiaFont: true }
    const { useSettingsStore, pickSettings } = await loadStore({ state: saved, version: 0 })
    expect(pickSettings(useSettingsStore.getState())).toEqual(saved)
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  })

  it('falls back to the default for each invalid saved value', async () => {
    const { useSettingsStore, pickSettings } = await loadStore({
      state: { theme: 'neon', textSize: 'larger', highContrast: 42 },
      version: 0,
    })
    expect(pickSettings(useSettingsStore.getState())).toEqual({
      ...DEFAULT_SETTINGS,
      textSize: 'larger',
    })
  })

  it('falls back to all the defaults when the saved value is not an object', async () => {
    const { useSettingsStore, pickSettings } = await loadStore({ state: 'broken', version: 0 })
    expect(pickSettings(useSettingsStore.getState())).toEqual(DEFAULT_SETTINGS)
  })

  it('saves, applies and sends each change made through a setter', async () => {
    const { useSettingsStore, save } = await loadStore()
    useSettingsStore.getState().setTextSize('largest')

    expect(document.documentElement).toHaveAttribute('data-text-size', 'largest')
    expect(JSON.parse(localStorage.getItem('settings') ?? '{}')).toEqual({
      state: { ...DEFAULT_SETTINGS, textSize: 'largest' },
      version: 0,
    })
    expect(save).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, textSize: 'largest' })
  })

  it('does not send values written with setState (from the account)', async () => {
    const { useSettingsStore, save } = await loadStore()
    useSettingsStore.setState({ theme: 'dark' })
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(save).not.toHaveBeenCalled()
  })

  it('picks up a change made in another tab', async () => {
    const { useSettingsStore } = await loadStore()
    const next = { ...DEFAULT_SETTINGS, theme: 'light' }
    localStorage.setItem('settings', JSON.stringify({ state: next, version: 0 }))
    window.dispatchEvent(new StorageEvent('storage', { key: 'settings' }))

    await vi.waitFor(() => expect(useSettingsStore.getState().theme).toBe('light'))
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })
})
