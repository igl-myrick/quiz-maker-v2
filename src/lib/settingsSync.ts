import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { storedSettingsSchema, type Settings } from '../schemas/settings'
import { announce } from '../stores/announcerStore'
import { pickSettings, useSettingsStore } from '../stores/settingsStore'
import { supabase } from './supabase'

// Keeps a member's settings in step with their account (feature 5, criteria 13–16).
// Plain functions, called from the auth store's listener and the settings setters.
//
// The member whose settings were last synced, which is also the member logged in.
// Supabase fires SIGNED_IN again when a tab regains focus, and both INITIAL_SESSION and
// SIGNED_IN can fire on one load, so a sync only runs when this changes.
let lastSyncedUserId: string | null = null

const SAVE_ERROR =
  "Couldn't save your settings to your account. They're still saved on this device."

function toRow(userId: string, settings: Settings) {
  return {
    user_id: userId,
    theme: settings.theme,
    text_size: settings.textSize,
    high_contrast: settings.highContrast,
    dyslexia_font: settings.dyslexiaFont,
  }
}

export async function syncSettingsOnAuthChange(event: AuthChangeEvent, session: Session | null) {
  if (event === 'SIGNED_OUT') {
    // The device keeps its settings; they just stop saving to the account.
    lastSyncedUserId = null
    return
  }
  if (event !== 'INITIAL_SESSION' && event !== 'SIGNED_IN') return
  const userId = session?.user.id
  if (!userId || userId === lastSyncedUserId) return
  lastSyncedUserId = userId

  const { data, error } = await supabase
    .from('user_settings')
    .select('theme, text_size, high_contrast, dyslexia_font')
    .eq('user_id', userId)
    .maybeSingle()
  // Failed: keep the local settings. It's tried again at the next login or page load.
  if (error) return
  // Logged out (or switched member) while that was loading.
  if (userId !== lastSyncedUserId) return

  if (data) {
    // The account's settings replace the local ones. setState, not the setters, so
    // they aren't written straight back.
    useSettingsStore.setState(
      storedSettingsSchema.parse({
        theme: data.theme,
        textSize: data.text_size,
        highContrast: data.high_contrast,
        dyslexiaFont: data.dyslexia_font,
      }),
    )
  } else {
    // First time on this account: it starts with this device's settings. ignoreDuplicates
    // means a second run can't fail on the primary key.
    await supabase
      .from('user_settings')
      .upsert(toRow(userId, pickSettings(useSettingsStore.getState())), {
        onConflict: 'user_id',
        ignoreDuplicates: true,
      })
  }
}

// Called by the setters after each change. Does nothing unless a member is logged in.
// The last write wins.
export async function saveSettingsToAccount(settings: Settings) {
  const userId = lastSyncedUserId
  if (!userId) return
  const { error } = await supabase
    .from('user_settings')
    .upsert(toRow(userId, settings), { onConflict: 'user_id' })
  if (error) announce(SAVE_ERROR)
}
