import type { Session } from '@supabase/supabase-js'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { readClaimToken, saveClaimToken } from '../../lib/claimTokens'
import { queryClient } from '../../lib/queryClient'
import { routeTree } from '../../routeTree.gen'
import type { ResultOk } from '../../schemas/result'
import { useAuthStore } from '../../stores/authStore'

type AuthListener = (event: string, session: Session | null) => void

const mocks = vi.hoisted(() => ({
  getResult: vi.fn(),
  claimResult: vi.fn(),
  listener: null as AuthListener | null,
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (name: string, args: unknown) =>
      name === 'claim_result' ? mocks.claimResult(args) : mocks.getResult(args),
    auth: {
      onAuthStateChange: (listener: AuthListener) => {
        mocks.listener = listener
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      },
      signInWithOtp: vi.fn(),
      verifyOtp: vi.fn(),
      signOut: vi.fn(),
    },
  },
}))

const RESULT_ID = 'c0000000-0000-4000-8000-000000000001'
const member = { access_token: 'token', user: { id: 'u1' } } as unknown as Session

function anonymousResult(overrides: Partial<ResultOk> = {}): ResultOk {
  return {
    status: 'ok',
    quiz_exists: true,
    quiz_updated: false,
    claimable: true,
    ...overrides,
    result: {
      id: RESULT_ID,
      quiz_id: null,
      quiz_version: 1,
      quiz_kind: 'personality',
      quiz_title: 'Which Season Matches You?',
      created_at: '2026-11-12T10:00:00Z',
      expires_at: '2026-11-13T10:00:00Z',
      score: null,
      snapshot: { quiz: { suggested_time_seconds: null }, questions: [] },
      winning_outcome: { id: 'w', title: 'Winter', description: 'Calm.' },
      timed: false,
      duration_seconds: null,
    },
  }
}

function owned(): ResultOk {
  const base = anonymousResult({ claimable: false })
  return { ...base, result: { ...base.result, expires_at: null } }
}

async function renderResult(session: Session | null) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [`/results/${RESULT_ID}`] }),
  })
  const view = render(<RouterProvider router={router} />)
  act(() => mocks.listener?.('INITIAL_SESSION', session))
  await screen.findByRole('heading', { level: 1, name: "You're Winter" })
  return view
}

function main() {
  return within(screen.getByRole('main'))
}

describe('SaveResultSection', () => {
  beforeEach(() => {
    localStorage.clear()
    queryClient.clear()
    queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } })
    useAuthStore.setState({ status: 'loading' }, true)
    mocks.getResult.mockReset().mockResolvedValue({ data: anonymousResult(), error: null })
    mocks.claimResult.mockReset().mockResolvedValue({ data: true, error: null })
    saveClaimToken(RESULT_ID, 'the-token')
  })

  it('is hidden in a browser without the claim token', async () => {
    localStorage.clear()
    await renderResult(member)
    expect(main().queryByRole('button', { name: /save/i })).not.toBeInTheDocument()
  })

  it('shows nothing on a result that is already owned, even with a stale token', async () => {
    mocks.getResult.mockResolvedValue({ data: owned(), error: null })
    await renderResult(member)
    expect(main().queryByRole('button', { name: /save/i })).not.toBeInTheDocument()
    expect(main().queryByText(/Saved to your account/)).not.toBeInTheDocument()
  })

  it('asks anonymous visitors to log in, with the same button becoming "Save to my account"', async () => {
    await renderResult(null)
    const button = main().getByRole('button', { name: 'Log in to save this result' })

    fireEvent.click(button)
    expect(screen.getByRole('dialog', { name: 'Log in or sign up' })).toHaveAttribute('open')

    act(() => mocks.listener?.('SIGNED_IN', member))
    expect(main().getByRole('button', { name: 'Save to my account' })).toBe(button)
    // Saving is a separate press, never automatic.
    expect(mocks.claimResult).not.toHaveBeenCalled()
  })

  it('saves the result, focuses the confirmation and removes the token', async () => {
    await renderResult(member)
    mocks.getResult.mockResolvedValue({ data: owned(), error: null })

    fireEvent.click(main().getByRole('button', { name: 'Save to my account' }))

    const message = await main().findByText(/Saved to your account\./)
    expect(message).toHaveFocus()
    expect(within(message).getByRole('link', { name: 'See your dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    )
    expect(mocks.claimResult).toHaveBeenCalledWith({ p_id: RESULT_ID, p_token: 'the-token' })
    expect(readClaimToken(RESULT_ID)).toBeNull()
    // The refreshed result has no expiry, so the "kept until" line goes.
    await waitFor(() =>
      expect(main().queryByText(/This result is kept until/)).not.toBeInTheDocument(),
    )
    expect(main().queryByRole('button', { name: /save/i })).not.toBeInTheDocument()
  })

  it('explains when the result can no longer be saved, and removes the token', async () => {
    mocks.claimResult.mockResolvedValue({ data: false, error: null })
    await renderResult(member)

    fireEvent.click(main().getByRole('button', { name: 'Save to my account' }))

    const message = await main().findByText(
      "This result can't be saved. It may have expired or already been saved.",
    )
    expect(message).toHaveFocus()
    expect(readClaimToken(RESULT_ID)).toBeNull()
  })

  it('keeps the button and the token after an error, so the member can retry', async () => {
    mocks.claimResult.mockResolvedValue({ data: null, error: new Error('down') })
    await renderResult(member)

    fireEvent.click(main().getByRole('button', { name: 'Save to my account' }))

    const message = await main().findByText('Something went wrong. Please try again.')
    expect(message).toHaveFocus()
    expect(main().getByRole('button', { name: 'Save to my account' })).toBeInTheDocument()
    expect(readClaimToken(RESULT_ID)).toBe('the-token')
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = await renderResult(null)
    expect(await axe(container)).toHaveNoViolations()
  })
})
