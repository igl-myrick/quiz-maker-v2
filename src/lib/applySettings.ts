import type { Settings } from '../schemas/settings'

// The one place settings reach the page: attributes on <html> that Ply and
// src/styles/settings.css respond to. index.html's inline script sets the same ones
// before the first paint.
export function applySettings(settings: Settings, root: HTMLElement = document.documentElement) {
  // No data-theme means System: Ply then follows prefers-color-scheme itself.
  if (settings.theme === 'system') delete root.dataset.theme
  else root.dataset.theme = settings.theme

  root.dataset.textSize = settings.textSize
  root.dataset.contrast = settings.highContrast

  if (settings.dyslexiaFont) root.dataset.font = 'lexend'
  else delete root.dataset.font
}
