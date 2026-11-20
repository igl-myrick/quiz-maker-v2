import type { Session } from '@supabase/supabase-js'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { routeTree } from '../routeTree.gen'
import { useAuthStore } from '../stores/authStore'

type AuthListener = (event: string, session: Session | null) => void

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  listener: null as AuthListener | null,
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: () => Promise.resolve({ data: [], error: null }),
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
      }),
    }),
    auth: {
      onAuthStateChange: (listener: AuthListener) => {
        mocks.listener = listener
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      },
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
  },
}))

const member = { access_token: 'token', user: { id: 'u1' } } as unknown as Session

function saveReturn(value: unknown) {
  sessionStorage.setItem('auth:return', JSON.stringify(value))
}

function renderCallback(search: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [`/auth/callback${search}`] }),
  })
  const view = render(<RouterProvider router={router} />)
  act(() => mocks.listener?.('INITIAL_SESSION', null))
  return { router, ...view }
}

async function arrivedAt(router: { state: { location: { href: string } } }, href: string) {
  await waitFor(() => expect(router.state.location.href).toBe(href))
}

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useAuthStore.setState({ status: 'loading' }, true)
    mocks.exchangeCodeForSession.mockReset().mockImplementation(() => {
      mocks.listener?.('SIGNED_IN', member)
      return Promise.resolve({ data: { session: member }, error: null })
    })
  })

  it('logs in, goes back to the saved page in place of the callback, and announces it', async () => {
    saveReturn({ path: '/search?q=cats' })
    const { router } = renderCallback('?code=abc')

    await arrivedAt(router, '/search?q=cats')
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledTimes(1)
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith('abc')
    expect(router.history.length).toBe(1)
    expect(await screen.findByText("You're logged in")).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Log out' })).toHaveFocus())
    expect(sessionStorage.getItem('auth:return')).toBeNull()
  })

  it('focuses the element the login was started for', async () => {
    saveReturn({ path: '/quizzes/new', focusId: 'quiz-editor-heading' })
    const { router } = renderCallback('?code=abc')

    await arrivedAt(router, '/quizzes/new')
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Create a quiz' })).toHaveFocus(),
    )
  })

  it('goes to the home page when no page was saved', async () => {
    const { router } = renderCallback('?code=abc')

    await arrivedAt(router, '/')
  })

  it.each([
    ['the person cancelled', '?error=access_denied', "Login cancelled. You're still logged out."],
    ['the provider failed', '?error=server_error', "Couldn't log you in. Please try again."],
  ])('stays logged out when %s', async (_case, search, message) => {
    saveReturn({ path: '/search?q=cats', focusId: 'quiz-editor-heading' })
    const { router } = renderCallback(search)

    await arrivedAt(router, '/search?q=cats')
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled()
    expect(await screen.findByText(message)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Log in' })).toHaveFocus())
    expect(sessionStorage.getItem('auth:return')).toBeNull()
  })

  it('stays logged out when the code can not be exchanged', async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ data: {}, error: new Error('bad code') })
    saveReturn({ path: '/search?q=cats' })
    const { router } = renderCallback('?code=abc')

    await arrivedAt(router, '/search?q=cats')
    expect(await screen.findByText("Couldn't log you in. Please try again.")).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Log in' })).toHaveFocus())
  })

  it('shows "Logging you in…" while it works, with no accessibility violations', async () => {
    mocks.exchangeCodeForSession.mockReturnValue(new Promise(() => {}))
    const { container } = renderCallback('?code=abc')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Logging you in…' }),
    ).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })
})
