import type { Session } from '@supabase/supabase-js'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { queryClient } from '../lib/queryClient'
import { routeTree } from '../routeTree.gen'
import { useAnnouncerStore } from '../stores/announcerStore'
import { useAuthStore } from '../stores/authStore'

type AuthListener = (event: string, session: Session | null) => void

const mocks = vi.hoisted(() => ({
  listener: null as AuthListener | null,
  invoke: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    // The dashboard's two lists, both empty.
    rpc: () => Promise.resolve({ data: { items: [], next_cursor: null }, error: null }),
    functions: { invoke: mocks.invoke },
    auth: {
      onAuthStateChange: (listener: AuthListener) => {
        mocks.listener = listener
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      },
      signOut: mocks.signOut,
    },
  },
}))

const member = { access_token: 'token', user: { id: 'u1' } } as unknown as Session

async function renderApp(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  const view = render(<RouterProvider router={router} />)
  act(() => mocks.listener?.('INITIAL_SESSION', member))
  await screen.findByRole('heading', { level: 1 })
  return { router, ...view }
}

// Opens Settings, then the delete dialog from its Account section.
function openDeleteDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
  const settings = screen.getByRole('dialog', { name: 'Settings' })
  fireEvent.click(within(settings).getByRole('button', { name: 'Delete my account' }))
  const dialog = screen.getByRole('dialog', { name: 'Delete your account?' })
  return { settings, dialog, inside: within(dialog) }
}

function confirmButton(dialog: HTMLElement) {
  return within(dialog).getByRole('button', { name: /Delete my account|Deleting…/ })
}

describe('DeleteAccountDialog', () => {
  beforeEach(() => {
    sessionStorage.clear()
    queryClient.clear()
    queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } })
    useAuthStore.setState({ status: 'loading' }, true)
    useAnnouncerStore.setState({ message: '' })
    mocks.invoke.mockReset().mockResolvedValue({ data: null, error: null })
    mocks.signOut.mockReset().mockImplementation(() => {
      mocks.listener?.('SIGNED_OUT', null)
      return Promise.resolve({ error: null })
    })
  })

  it('opens over Settings with Cancel focused, explaining what is deleted', async () => {
    await renderApp('/')
    const { settings, dialog, inside } = openDeleteDialog()

    expect(settings).toHaveAttribute('open')
    expect(dialog).toHaveAttribute('open')
    expect(inside.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    expect(dialog).toHaveAccessibleDescription(
      "This permanently deletes your account, your saved results and the quizzes you made. This can't be undone.",
    )
    expect(inside.getByRole('textbox', { name: 'Type delete to confirm' })).toHaveAttribute(
      'autocomplete',
      'off',
    )
  })

  it('needs the word delete, in any capitals and with spaces trimmed', async () => {
    await renderApp('/')
    const { dialog, inside } = openDeleteDialog()
    const field = inside.getByRole('textbox', { name: 'Type delete to confirm' })
    expect(confirmButton(dialog)).toHaveAttribute('aria-disabled', 'true')

    fireEvent.change(field, { target: { value: 'nope' } })
    fireEvent.click(confirmButton(dialog))
    const error = await inside.findByText('Type the word delete to confirm.')
    expect(field).toHaveFocus()
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription('Type the word delete to confirm.')
    expect(error).toBeInTheDocument()
    expect(mocks.invoke).not.toHaveBeenCalled()

    fireEvent.change(field, { target: { value: '  DeLeTe ' } })
    expect(confirmButton(dialog)).toHaveAttribute('aria-disabled', 'false')
  })

  it('deletes the account: closes both dialogs, then signs out, clears drafts, goes home and announces', async () => {
    sessionStorage.setItem('quiz-draft:new', '{}')
    sessionStorage.setItem('quiz-takes', '{}')
    const { router } = await renderApp('/dashboard')
    const { settings, dialog, inside } = openDeleteDialog()

    let openWhenSigningOut: number | null = null
    mocks.signOut.mockImplementation(() => {
      openWhenSigningOut = document.querySelectorAll('dialog[open]').length
      mocks.listener?.('SIGNED_OUT', null)
      return Promise.resolve({ error: null })
    })

    fireEvent.change(inside.getByRole('textbox'), { target: { value: 'delete' } })
    fireEvent.click(confirmButton(dialog))

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(mocks.invoke).toHaveBeenCalledWith('delete-account', { method: 'POST' })
    expect(settings).not.toHaveAttribute('open')
    expect(openWhenSigningOut).toBe(0)
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(sessionStorage.getItem('quiz-draft:new')).toBeNull()
    expect(sessionStorage.getItem('quiz-takes')).toBe('{}')
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument()

    // The deletion message comes after the page-change announcement, so it's the one left.
    await waitFor(() =>
      expect(useAnnouncerStore.getState().message).toBe('Your account has been deleted'),
    )
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(useAnnouncerStore.getState().message).toBe('Your account has been deleted')
  })

  it('focuses the heading when the member was already on the home page', async () => {
    await renderApp('/')
    const { dialog, inside } = openDeleteDialog()
    fireEvent.change(inside.getByRole('textbox'), { target: { value: 'delete' } })
    fireEvent.click(confirmButton(dialog))

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Quiz Maker' })).toHaveFocus(),
    )
  })

  it('sends one request for a double click', async () => {
    mocks.invoke.mockReturnValue(new Promise(() => {}))
    await renderApp('/')
    const { dialog, inside } = openDeleteDialog()
    fireEvent.change(inside.getByRole('textbox'), { target: { value: 'delete' } })

    fireEvent.click(confirmButton(dialog))
    await waitFor(() => expect(confirmButton(dialog)).toHaveTextContent('Deleting…'))
    expect(confirmButton(dialog)).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(confirmButton(dialog))
    await act(async () => {})

    expect(mocks.invoke).toHaveBeenCalledTimes(1)
  })

  it('stays open and announces an error when deleting fails, clearing nothing', async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: new Error('down') })
    sessionStorage.setItem('quiz-draft:new', '{}')
    await renderApp('/')
    const { settings, dialog, inside } = openDeleteDialog()
    fireEvent.change(inside.getByRole('textbox'), { target: { value: 'delete' } })
    fireEvent.click(confirmButton(dialog))

    expect(await inside.findByRole('alert')).toHaveTextContent(
      "Couldn't delete your account. Please try again.",
    )
    expect(dialog).toHaveAttribute('open')
    expect(settings).toHaveAttribute('open')
    expect(mocks.signOut).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('quiz-draft:new')).toBe('{}')
    expect(confirmButton(dialog)).toHaveTextContent('Delete my account')
  })

  it('starts again after Cancel', async () => {
    await renderApp('/')
    const { dialog, inside } = openDeleteDialog()
    fireEvent.change(inside.getByRole('textbox'), { target: { value: 'delete' } })
    fireEvent.click(inside.getByRole('button', { name: 'Cancel' }))
    expect(dialog).not.toHaveAttribute('open')
    // Closed, so hidden from the accessibility tree.
    expect(inside.getByRole('textbox', { hidden: true })).toHaveValue('')
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = await renderApp('/')
    openDeleteDialog()
    expect(await axe(container)).toHaveNoViolations()
  })
})
