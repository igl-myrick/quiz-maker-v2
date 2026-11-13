import type { Session } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { useAuthStore } from '../stores/authStore'
import { Announcer } from './Announcer'
import { SiteHeader } from './SiteHeader'

type AuthListener = (event: string, session: Session | null) => void

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  listener: null as AuthListener | null,
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: mocks.signOut,
      signInWithOtp: vi.fn(),
      verifyOtp: vi.fn(),
      onAuthStateChange: (listener: AuthListener) => {
        mocks.listener = listener
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      },
    },
  },
}))

// The header only needs Link to render a plain link in these tests.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}))

const memberSession = {
  access_token: 'token',
  user: { id: '11111111-1111-4111-8111-111111111111', email: 'alex@example.test' },
} as unknown as Session

function fireAuthEvent(event: string, session: Session | null) {
  act(() => {
    mocks.listener?.(event, session)
  })
}

function renderHeader() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <SiteHeader />
      <Announcer />
    </QueryClientProvider>,
  )
}

describe('SiteHeader', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: 'loading' }, true)
    mocks.signOut.mockReset().mockResolvedValue({ error: null })
  })

  it('shows no auth button while auth is still loading', () => {
    renderHeader()

    expect(screen.queryByRole('button', { name: 'Log in' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Quiz Maker' })).toHaveAttribute('href', '/')
  })

  it('shows "Log in" for an anonymous visitor', () => {
    renderHeader()
    fireAuthEvent('INITIAL_SESSION', null)

    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument()
  })

  it('switches the same button to "Log out" for a member, without showing their email', () => {
    renderHeader()
    fireAuthEvent('INITIAL_SESSION', null)
    const button = screen.getByRole('button', { name: 'Log in' })

    fireAuthEvent('SIGNED_IN', memberSession)

    expect(screen.getByRole('button', { name: 'Log out' })).toBe(button)
    expect(screen.queryByText(/alex@example\.test/)).not.toBeInTheDocument()
  })

  it('shows the Dashboard link to members only, after Create quiz', () => {
    renderHeader()
    fireAuthEvent('INITIAL_SESSION', null)
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument()

    fireAuthEvent('SIGNED_IN', memberSession)
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard')
    const names = screen
      .getAllByRole('listitem')
      .map((item) => item.textContent)
      .slice(1)
    expect(names).toEqual(['Search', 'Create quiz', 'Dashboard', 'Log out'])
  })

  it('logs out, switches back to "Log in", and announces it', async () => {
    renderHeader()
    fireAuthEvent('INITIAL_SESSION', memberSession)

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
    expect(mocks.signOut).toHaveBeenCalled()
    fireAuthEvent('SIGNED_OUT', null)

    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument()
    expect(await screen.findByText("You're logged out")).toBeInTheDocument()
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = renderHeader()
    fireAuthEvent('INITIAL_SESSION', null)

    expect(await axe(container)).toHaveNoViolations()
  })
})
