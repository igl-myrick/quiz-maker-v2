import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { takeAuthReturn } from '../lib/authReturn'
import { LoginButton } from './LoginButton'

const mocks = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signInWithOAuth: mocks.signInWithOAuth } },
}))

function renderLogin(returnFocusId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <LoginButton returnFocusId={returnFocusId} />
    </QueryClientProvider>,
  )
}

function getDialog() {
  return screen.getByRole('dialog', { name: 'Log in or sign up', hidden: true })
}

function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
}

describe('LoginDialog', () => {
  beforeEach(() => {
    sessionStorage.clear()
    window.history.replaceState(null, '', '/results/abc')
    mocks.signInWithOAuth.mockReset().mockResolvedValue({ data: {}, error: null })
  })

  it('opens with focus on "Continue with Google", with GitHub after it', () => {
    renderLogin()
    openDialog()

    expect(getDialog()).toHaveAttribute('open')
    const google = screen.getByRole('button', { name: 'Continue with Google' })
    const github = screen.getByRole('button', { name: 'Continue with GitHub' })
    expect(google).toHaveFocus()
    expect(google.compareDocumentPosition(github) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it.each([
    ['Google', 'google'],
    ['GitHub', 'github'],
  ])('starts a %s login that comes back to /auth/callback', async (name, provider) => {
    renderLogin('save-result-button')
    openDialog()

    fireEvent.click(screen.getByRole('button', { name: `Continue with ${name}` }))

    await waitFor(() =>
      expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      }),
    )
    expect(takeAuthReturn()).toEqual({ path: '/results/abc', focusId: 'save-result-button' })
  })

  it('says it is opening the provider and blocks a second press', async () => {
    mocks.signInWithOAuth.mockReturnValue(new Promise(() => {}))
    renderLogin()
    openDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Continue with GitHub' }))

    const opening = await screen.findByRole('button', { name: 'Opening GitHub…' })
    expect(opening).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDisabled()
  })

  it('stays open with an error, forgets the return state, and refocuses the button', async () => {
    mocks.signInWithOAuth.mockResolvedValue({ data: {}, error: new Error('offline') })
    renderLogin()
    openDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Continue with GitHub' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    )
    expect(getDialog()).toHaveAttribute('open')
    expect(sessionStorage.getItem('auth:return')).toBeNull()
    const github = screen.getByRole('button', { name: 'Continue with GitHub' })
    expect(github).toBeEnabled()
    await waitFor(() => expect(github).toHaveFocus())
  })

  it('starts again with no error after closing and reopening', async () => {
    mocks.signInWithOAuth.mockResolvedValue({ data: {}, error: new Error('offline') })
    renderLogin()
    openDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))
    await screen.findByRole('alert')

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    openDialog()

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled()
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = renderLogin()
    openDialog()

    expect(await axe(container)).toHaveNoViolations()
  })
})
