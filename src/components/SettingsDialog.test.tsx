import type { Session } from '@supabase/supabase-js'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { routeTree } from '../routeTree.gen'
import { DEFAULT_SETTINGS } from '../schemas/settings'
import { useAuthStore } from '../stores/authStore'
import { useSettingsStore } from '../stores/settingsStore'

type AuthListener = (event: string, session: Session | null) => void

const mocks = vi.hoisted(() => ({ listener: null as AuthListener | null }))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (listener: AuthListener) => {
        mocks.listener = listener
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      },
    },
  },
}))

const member = { access_token: 'token', user: { id: 'u1' } } as unknown as Session

async function renderApp(session: Session | null) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  const view = render(<RouterProvider router={router} />)
  await screen.findByRole('heading', { level: 1, name: 'Quiz Maker' })
  act(() => mocks.listener?.('INITIAL_SESSION', session))
  return view
}

function openSettings() {
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
  return screen.getByRole<HTMLDialogElement>('dialog', { name: 'Settings' })
}

const html = document.documentElement

describe('SettingsDialog', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: 'loading' }, true)
    useSettingsStore.setState(DEFAULT_SETTINGS)
  })

  it('opens from the Settings button for everyone, with no Account section', async () => {
    await renderApp(null)
    const dialog = openSettings()

    expect(dialog).toHaveAttribute('open')
    expect(within(dialog).queryByRole('heading', { name: 'Account' })).not.toBeInTheDocument()
    expect(
      within(dialog).queryByRole('button', { name: 'Delete my account' }),
    ).not.toBeInTheDocument()
  })

  it('shows the Account section to members', async () => {
    await renderApp(member)
    const dialog = openSettings()
    expect(within(dialog).getByRole('heading', { name: 'Account' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Delete my account' })).toBeInTheDocument()
  })

  it('focuses the chosen theme when it opens', async () => {
    useSettingsStore.setState({ theme: 'dark' })
    await renderApp(null)
    const dialog = openSettings()
    expect(within(dialog).getByRole('radio', { name: 'Dark' })).toHaveFocus()
  })

  it('applies each change at once, to the store and the page', async () => {
    await renderApp(null)
    const dialog = within(openSettings())

    fireEvent.click(dialog.getByRole('radio', { name: 'Dark' }))
    expect(useSettingsStore.getState().theme).toBe('dark')
    expect(html).toHaveAttribute('data-theme', 'dark')

    fireEvent.click(dialog.getByRole('radio', { name: 'System' }))
    expect(html).not.toHaveAttribute('data-theme')

    fireEvent.click(dialog.getByRole('radio', { name: 'Largest' }))
    expect(useSettingsStore.getState().textSize).toBe('largest')
    expect(html).toHaveAttribute('data-text-size', 'largest')

    fireEvent.click(dialog.getByRole('radio', { name: 'On' }))
    expect(useSettingsStore.getState().highContrast).toBe('on')
    expect(html).toHaveAttribute('data-contrast', 'on')

    const font = dialog.getByRole('checkbox', {
      name: 'Use Lexend, a font designed for easier reading',
    })
    fireEvent.click(font)
    expect(font).toBeChecked()
    expect(html).toHaveAttribute('data-font', 'lexend')
    fireEvent.click(font)
    expect(html).not.toHaveAttribute('data-font')
  })

  it('groups each setting in a fieldset named by its legend', async () => {
    await renderApp(null)
    const dialog = within(openSettings())
    for (const name of ['Theme', 'Text size', 'High contrast', 'Font']) {
      expect(dialog.getByRole('group', { name })).toBeInTheDocument()
    }
    expect(dialog.getByRole('radio', { name: 'Follow system' })).toBeChecked()
    expect(dialog.getByRole('radio', { name: 'Default' })).toBeChecked()
  })

  it('closes with Escape and with the close button', async () => {
    await renderApp(null)
    let dialog = openSettings()
    // jsdom has no Escape handling: the browser sends cancel, then closes the dialog.
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    dialog.close()
    expect(dialog).not.toHaveAttribute('open')

    dialog = openSettings()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(dialog).not.toHaveAttribute('open')
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = await renderApp(member)
    openSettings()
    expect(await axe(container)).toHaveNoViolations()
  })
})
