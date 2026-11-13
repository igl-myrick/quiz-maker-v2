import type { Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../schemas/settings'
import { pickSettings, useSettingsStore } from '../stores/settingsStore'
import { syncSettingsOnAuthChange } from './settingsSync'

// vitest.setup.ts mocks this module for every other test file.
vi.unmock('./settingsSync')

const mocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  upsert: vi.fn(),
  announce: vi.fn(),
}))

vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }),
      upsert: mocks.upsert,
    }),
  },
}))

vi.mock('../stores/announcerStore', () => ({ announce: mocks.announce }))

function session(userId: string) {
  return { access_token: 'token', user: { id: userId } } as unknown as Session
}

const accountRow = { theme: 'dark', text_size: 'large', high_contrast: 'on', dyslexia_font: true }

describe('settingsSync', () => {
  beforeEach(async () => {
    // Log out first: that resets which member was last synced.
    await syncSettingsOnAuthChange('SIGNED_OUT', null)
    useSettingsStore.setState(DEFAULT_SETTINGS)
    mocks.maybeSingle.mockReset().mockResolvedValue({ data: null, error: null })
    mocks.upsert.mockReset().mockResolvedValue({ error: null })
    mocks.announce.mockReset()
  })

  it("replaces the local settings with the account's, without writing them back", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: accountRow, error: null })
    await syncSettingsOnAuthChange('SIGNED_IN', session('u1'))

    expect(pickSettings(useSettingsStore.getState())).toEqual({
      theme: 'dark',
      textSize: 'large',
      highContrast: 'on',
      dyslexiaFont: true,
    })
    expect(mocks.upsert).not.toHaveBeenCalled()
  })

  it('saves the local settings when the account has none yet', async () => {
    useSettingsStore.setState({ textSize: 'larger' })
    await syncSettingsOnAuthChange('INITIAL_SESSION', session('u1'))

    expect(mocks.upsert).toHaveBeenCalledWith(
      {
        user_id: 'u1',
        theme: 'system',
        text_size: 'larger',
        high_contrast: 'system',
        dyslexia_font: false,
      },
      { onConflict: 'user_id', ignoreDuplicates: true },
    )
    expect(useSettingsStore.getState().textSize).toBe('larger')
  })

  it('syncs only once for the same member', async () => {
    await syncSettingsOnAuthChange('INITIAL_SESSION', session('u1'))
    await syncSettingsOnAuthChange('SIGNED_IN', session('u1'))
    await syncSettingsOnAuthChange('SIGNED_IN', session('u1'))
    expect(mocks.maybeSingle).toHaveBeenCalledTimes(1)
  })

  it('syncs again after logging out and in as someone else', async () => {
    await syncSettingsOnAuthChange('SIGNED_IN', session('u1'))
    await syncSettingsOnAuthChange('SIGNED_OUT', null)
    await syncSettingsOnAuthChange('SIGNED_IN', session('u2'))
    expect(mocks.maybeSingle).toHaveBeenCalledTimes(2)
  })

  it('does nothing for an anonymous visitor', async () => {
    await syncSettingsOnAuthChange('INITIAL_SESSION', null)
    expect(mocks.maybeSingle).not.toHaveBeenCalled()
  })

  it('keeps the local settings, silently, when loading fails', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: 'down' } })
    useSettingsStore.setState({ theme: 'light' })
    await syncSettingsOnAuthChange('SIGNED_IN', session('u1'))

    expect(useSettingsStore.getState().theme).toBe('light')
    expect(mocks.upsert).not.toHaveBeenCalled()
    expect(mocks.announce).not.toHaveBeenCalled()
  })

  it('saves each change to the account only while a member is logged in', async () => {
    useSettingsStore.getState().setTheme('dark')
    await Promise.resolve()
    expect(mocks.upsert).not.toHaveBeenCalled()

    await syncSettingsOnAuthChange('SIGNED_IN', session('u1'))
    mocks.upsert.mockClear()
    useSettingsStore.getState().setDyslexiaFont(true)

    await vi.waitFor(() =>
      expect(mocks.upsert).toHaveBeenCalledWith(
        {
          user_id: 'u1',
          theme: 'dark',
          text_size: 'default',
          high_contrast: 'system',
          dyslexia_font: true,
        },
        { onConflict: 'user_id' },
      ),
    )

    await syncSettingsOnAuthChange('SIGNED_OUT', null)
    mocks.upsert.mockClear()
    useSettingsStore.getState().setTheme('light')
    await Promise.resolve()
    expect(mocks.upsert).not.toHaveBeenCalled()
  })

  it('announces when saving a change fails, and keeps the change', async () => {
    await syncSettingsOnAuthChange('SIGNED_IN', session('u1'))
    mocks.upsert.mockResolvedValue({ error: { message: 'down' } })
    useSettingsStore.getState().setTextSize('largest')

    await vi.waitFor(() =>
      expect(mocks.announce).toHaveBeenCalledWith(
        "Couldn't save your settings to your account. They're still saved on this device.",
      ),
    )
    expect(useSettingsStore.getState().textSize).toBe('largest')
  })
})
