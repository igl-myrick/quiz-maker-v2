import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../schemas/settings'
import { applySettings } from './applySettings'

function attributes(root: HTMLElement) {
  return {
    theme: root.getAttribute('data-theme'),
    textSize: root.getAttribute('data-text-size'),
    contrast: root.getAttribute('data-contrast'),
    font: root.getAttribute('data-font'),
  }
}

describe('applySettings', () => {
  it('sets every attribute for chosen settings', () => {
    const root = document.createElement('html')
    applySettings(
      { theme: 'dark', textSize: 'largest', highContrast: 'on', dyslexiaFont: true },
      root,
    )
    expect(attributes(root)).toEqual({
      theme: 'dark',
      textSize: 'largest',
      contrast: 'on',
      font: 'lexend',
    })
  })

  it('removes data-theme for System and data-font when the font is off', () => {
    const root = document.createElement('html')
    applySettings(
      { theme: 'light', textSize: 'large', highContrast: 'off', dyslexiaFont: true },
      root,
    )
    applySettings(DEFAULT_SETTINGS, root)
    expect(attributes(root)).toEqual({
      theme: null,
      textSize: 'default',
      contrast: 'system',
      font: null,
    })
  })

  it('uses <html> by default', () => {
    applySettings({ ...DEFAULT_SETTINGS, theme: 'light' })
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    applySettings(DEFAULT_SETTINGS)
    expect(document.documentElement).not.toHaveAttribute('data-theme')
  })
})
