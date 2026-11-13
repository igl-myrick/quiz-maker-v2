import { z } from 'zod'

// The allowed values. Keep these in step with the inline script in index.html and the
// user_settings constraints (supabase/migrations/20261113000300_user_settings.sql).
export const THEMES = ['system', 'light', 'dark'] as const
export const TEXT_SIZES = ['default', 'large', 'larger', 'largest'] as const
export const CONTRAST_PREFS = ['system', 'on', 'off'] as const

export const settingsSchema = z.object({
  theme: z.enum(THEMES),
  textSize: z.enum(TEXT_SIZES),
  highContrast: z.enum(CONTRAST_PREFS),
  dyslexiaFont: z.boolean(),
})

export type Settings = z.infer<typeof settingsSchema>
export type Theme = Settings['theme']
export type TextSize = Settings['textSize']
export type ContrastPref = Settings['highContrast']

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  textSize: 'default',
  highContrast: 'system',
  dyslexiaFont: false,
}

// For values read from storage or the server: each invalid or missing value falls back
// to its default, and anything that isn't an object falls back to all the defaults.
export const storedSettingsSchema = z
  .object({
    theme: settingsSchema.shape.theme.catch(DEFAULT_SETTINGS.theme),
    textSize: settingsSchema.shape.textSize.catch(DEFAULT_SETTINGS.textSize),
    highContrast: settingsSchema.shape.highContrast.catch(DEFAULT_SETTINGS.highContrast),
    dyslexiaFont: settingsSchema.shape.dyslexiaFont.catch(DEFAULT_SETTINGS.dyslexiaFont),
  })
  .catch(DEFAULT_SETTINGS)
