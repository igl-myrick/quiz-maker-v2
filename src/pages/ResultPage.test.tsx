import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { queryClient } from '../lib/queryClient'
import { routeTree } from '../routeTree.gen'
import type { ResultOk } from '../schemas/result'
import { useAnnouncerStore } from '../stores/announcerStore'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

const RESULT_ID = 'c0000000-0000-4000-8000-000000000001'
const QUIZ_ID = 'a0000000-0000-4000-8000-000000000001'

function trivia(overrides: Partial<ResultOk> = {}): ResultOk {
  return {
    status: 'ok',
    quiz_exists: true,
    quiz_updated: false,
    claimable: false,
    ...overrides,
    result: {
      id: RESULT_ID,
      quiz_id: QUIZ_ID,
      quiz_version: 1,
      quiz_kind: 'trivia',
      quiz_title: 'World Capitals',
      created_at: '2026-11-12T10:00:00Z',
      expires_at: null,
      score: 0.625,
      snapshot: {
        quiz: { suggested_time_seconds: 300 },
        questions: [
          {
            id: 'q1',
            position: 1,
            type: 'single_choice',
            prompt: 'Capital of Japan?',
            options: [
              { id: 'q1a', label: 'Kyoto', is_correct: false },
              { id: 'q1b', label: 'Tokyo', is_correct: true },
            ],
            selected_option_ids: ['q1b'],
            score: 1,
          },
          {
            id: 'q2',
            position: 2,
            type: 'multi_select',
            prompt: 'Which are capitals?',
            options: [
              { id: 'q2a', label: 'Lisbon', is_correct: true },
              { id: 'q2b', label: 'Nairobi', is_correct: true },
              { id: 'q2c', label: 'Sydney', is_correct: false },
            ],
            selected_option_ids: ['q2a'],
            score: 0.5,
          },
          {
            id: 'q3',
            position: 3,
            type: 'true_false',
            prompt: 'Ottawa is in Canada.',
            options: [
              { id: 'q3t', label: 'True', is_correct: true },
              { id: 'q3f', label: 'False', is_correct: false },
            ],
            selected_option_ids: ['q3f'],
            score: 0,
          },
        ],
      },
      winning_outcome: null,
      timed: true,
      duration_seconds: 185,
      ...overrides.result,
    },
  }
}

function personality(): ResultOk {
  const base = trivia()
  return {
    ...base,
    result: {
      ...base.result,
      quiz_kind: 'personality',
      quiz_title: 'Which Season Matches You?',
      score: null,
      timed: false,
      duration_seconds: null,
      winning_outcome: {
        id: 'w',
        title: 'Winter',
        description: 'Calm, quiet and at home by the fire.',
      },
      snapshot: { quiz: { suggested_time_seconds: null }, questions: [] },
    },
  }
}

async function renderResult(response: unknown) {
  mocks.rpc.mockResolvedValue({ data: response, error: null })
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [`/results/${RESULT_ID}`] }),
  })
  const view = render(<RouterProvider router={router} />)
  await screen.findByRole('main')
  return view
}

function main() {
  return within(screen.getByRole('main'))
}

describe('ResultPage', () => {
  beforeEach(() => {
    queryClient.clear()
    queryClient.setDefaultOptions({ queries: { retry: false } })
    useAnnouncerStore.setState({ message: '' })
    mocks.rpc.mockReset()
  })

  it('shows a trivia score, a summary that never relies on colour, and each question', async () => {
    await renderResult(trivia())

    expect(main().getByRole('heading', { level: 1, name: 'World Capitals' })).toBeInTheDocument()
    expect(main().getByText('1.5 / 3 (50%)')).toBeInTheDocument()
    expect(main().getByText(/1 correct · .*1 partly correct · .*1 wrong/)).toBeInTheDocument()
    expect(main().getByText('Correct: 1 point')).toBeInTheDocument()
    expect(main().getByText('Partly correct: 0.5 points')).toBeInTheDocument()
    expect(main().getByText('Wrong: 0 points')).toBeInTheDocument()

    const multi = main()
      .getByRole('heading', { name: 'Question 2: Which are capitals?' })
      .closest('li')
    expect(multi).toHaveTextContent('Lisbon (your answer, correct)')
    expect(multi).toHaveTextContent("Nairobi (correct answer you didn't choose)")
    expect(multi).toHaveTextContent('Sydney (not correct)')
    expect(main().getByText('Finished in 3:05 (suggested 5:00)')).toBeInTheDocument()
  })

  it('shows only the winning outcome for a personality result', async () => {
    await renderResult(personality())

    expect(main().getByRole('heading', { level: 1, name: "You're Winter" })).toBeInTheDocument()
    expect(main().getByText('Calm, quiet and at home by the fire.')).toBeInTheDocument()
    expect(
      main().getByRole('heading', { level: 2, name: 'Which Season Matches You?' }),
    ).toBeInTheDocument()
    expect(main().queryByText(/Question by question/)).not.toBeInTheDocument()
    expect(main().queryByText(/Finished in/)).not.toBeInTheDocument()
  })

  it('shows the updated, deleted and expiry notices', async () => {
    const updated = trivia({ quiz_updated: true })
    updated.result.expires_at = '2026-11-13T10:00:00Z'
    const { unmount } = await renderResult(updated)

    expect(
      main().getByText(/This quiz has been updated since this result was saved/),
    ).toBeInTheDocument()
    expect(main().getByRole('link', { name: 'See the current version' })).toHaveAttribute(
      'href',
      `/search?quiz=${QUIZ_ID}`,
    )
    // The login sentence is gone: the Save button covers it, only where it can work.
    expect(main().getByText(/^This result is kept until .*\.$/)).toBeInTheDocument()
    expect(main().queryByText(/Log in to save it/)).not.toBeInTheDocument()
    unmount()
    queryClient.clear()

    const deleted = trivia({ quiz_exists: false })
    deleted.result.quiz_id = null
    await renderResult(deleted)
    expect(main().getByText('The original quiz no longer exists.')).toBeInTheDocument()
    expect(main().queryByRole('link', { name: 'See the current version' })).not.toBeInTheDocument()
  })

  it('explains expired and missing results', async () => {
    const { unmount } = await renderResult({ status: 'expired' })
    expect(
      main().getByText('This result has expired. Anonymous results are kept for 1 day.'),
    ).toBeInTheDocument()
    unmount()
    queryClient.clear()

    await renderResult({ status: 'not_found' })
    expect(
      main().getByText(
        "This result doesn't exist or has expired. Anonymous results are kept for 1 day.",
      ),
    ).toBeInTheDocument()
    expect(main().getByRole('link', { name: 'Find a quiz' })).toHaveAttribute('href', '/search')
  })

  it('copies the link and announces it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await renderResult(trivia())

    fireEvent.click(main().getByRole('button', { name: 'Copy link' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(window.location.href))
    await waitFor(() => expect(useAnnouncerStore.getState().message).toBe('Link copied'))
  })

  it('shows the link in a field when copying is not allowed', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await renderResult(trivia())

    fireEvent.click(main().getByRole('button', { name: 'Copy link' }))

    const field = await main().findByRole('textbox', { name: 'Result link (copy it from here)' })
    expect(field).toHaveAttribute('readonly')
    expect(field).toHaveFocus()
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = await renderResult(trivia())

    expect(await axe(container)).toHaveNoViolations()
  })
})
