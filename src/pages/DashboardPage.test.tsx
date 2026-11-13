import type { Session } from '@supabase/supabase-js'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { queryClient } from '../lib/queryClient'
import { routeTree } from '../routeTree.gen'
import type { MyResult } from '../schemas/myResults'
import type { QuizSummary } from '../schemas/searchResult'
import { useAnnouncerStore } from '../stores/announcerStore'
import { useAuthStore } from '../stores/authStore'

type AuthListener = (event: string, session: Session | null) => void
type Page<T> = { items: T[]; next_cursor: { created_at: string; id: string } | null }

const mocks = vi.hoisted(() => ({
  listResults: vi.fn(),
  listQuizzes: vi.fn(),
  deleteSelect: vi.fn(),
  listener: null as AuthListener | null,
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (name: string, args: { p_cursor?: unknown }) => {
      if (name === 'list_my_results') return mocks.listResults(args)
      if (name === 'list_my_quizzes') return mocks.listQuizzes(args)
      return Promise.resolve({
        data: { mode: 'browse', total: 0, items: [], next_cursor: null },
        error: null,
      })
    },
    from: () => ({
      delete: () => ({ eq: () => ({ select: mocks.deleteSelect }) }),
      // The details popup's quiz.
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: worldCapitals(), error: null }),
        }),
      }),
    }),
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

const member = {
  access_token: 'token',
  user: { id: '11111111-1111-4111-8111-111111111111', email: 'alex@example.test' },
} as unknown as Session

const CURSOR = { created_at: '2026-11-01T00:00:00Z', id: 'cursor' }

function id(n: number) {
  return `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

function worldCapitals(): QuizSummary {
  return {
    id: id(1),
    kind: 'trivia',
    title: 'World Capitals',
    description: 'Name the capital cities.',
    question_count: 4,
    suggested_time_seconds: 300,
  }
}

function quiz(n: number, title: string): QuizSummary {
  return { ...worldCapitals(), id: id(n), title, description: '' }
}

function result(n: number, overrides: Partial<MyResult> = {}): MyResult {
  return {
    id: `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    quiz_kind: 'trivia',
    quiz_title: `Result ${n}`,
    created_at: '2026-11-12T10:00:00Z',
    score: 1,
    question_count: 3,
    winning_outcome_title: null,
    quiz_status: 'current',
    ...overrides,
  }
}

function page<T>(items: T[], next_cursor: Page<T>['next_cursor'] = null) {
  return Promise.resolve({ data: { items, next_cursor }, error: null })
}

async function renderDashboard(session: Session | null = member) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/dashboard'] }),
  })
  const view = render(<RouterProvider router={router} />)
  await screen.findByRole('main')
  if (session !== undefined) act(() => mocks.listener?.('INITIAL_SESSION', session))
  return { router, ...view }
}

function main() {
  return within(screen.getByRole('main'))
}

function section(name: string) {
  return within(main().getByRole('region', { name }))
}

function openDialog() {
  return screen
    .getAllByRole('dialog', { hidden: true })
    .find((dialog) => dialog.hasAttribute('open'))
}

describe('DashboardPage', () => {
  beforeEach(() => {
    queryClient.clear()
    queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } })
    useAuthStore.setState({ status: 'loading' }, true)
    useAnnouncerStore.setState({ message: '' })
    mocks.listResults.mockReset().mockImplementation(() => page([]))
    mocks.listQuizzes.mockReset().mockImplementation(() => page([]))
    mocks.deleteSelect.mockReset().mockResolvedValue({ data: [{ id: id(1) }], error: null })
  })

  it('shows only the heading while login state is loading', async () => {
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/dashboard'] }),
    })
    render(<RouterProvider router={router} />)
    await screen.findByRole('main')

    expect(main().getByRole('heading', { level: 1, name: 'Your dashboard' })).toBeInTheDocument()
    expect(main().queryByText(/Log in with/)).not.toBeInTheDocument()
    expect(main().queryByRole('heading', { level: 2 })).not.toBeInTheDocument()
  })

  it('points anonymous visitors at the header Log in button', async () => {
    await renderDashboard(null)

    expect(main().getByRole('heading', { level: 1, name: 'Your dashboard' })).toBeInTheDocument()
    expect(
      main().getByText(
        (_, element) =>
          element?.tagName === 'P' &&
          element.textContent ===
            'Log in with the Log in button at the top of the page to see your dashboard.',
      ),
    ).toBeInTheDocument()
    expect(main().queryByRole('button')).not.toBeInTheDocument()
    expect(mocks.listResults).not.toHaveBeenCalled()
  })

  it('shows My results then My quizzes, without the member’s email', async () => {
    mocks.listResults.mockImplementation(() =>
      page([
        result(1, { quiz_title: 'World Capitals', score: 0.875, question_count: 4 }),
        result(2, {
          quiz_kind: 'personality',
          quiz_title: 'Which Season Matches You?',
          score: null,
          question_count: null,
          winning_outcome_title: 'Winter',
          quiz_status: 'updated',
        }),
        result(3, { quiz_title: 'Gone Quiz', score: 0, quiz_status: 'deleted' }),
      ]),
    )
    mocks.listQuizzes.mockImplementation(() => page([worldCapitals()]))
    await renderDashboard()

    const headings = await waitFor(() => {
      const found = main().getAllByRole('heading', { level: 2 })
      if (found.length < 2) throw new Error('sections not ready')
      return found
    })
    expect(headings.map((h) => h.textContent)).toEqual(['My results', 'My quizzes'])
    expect(screen.queryByText(/alex@example\.test/)).not.toBeInTheDocument()

    const results = section('My results')
    const trivia = (await results.findByRole('link', { name: 'World Capitals' })).closest('li')
    expect(results.getByRole('link', { name: 'World Capitals' })).toHaveAttribute(
      'href',
      `/results/${result(1).id}`,
    )
    expect(trivia).toHaveTextContent('Trivia 3.5 / 4')
    expect(trivia?.querySelector('time')).toHaveAttribute('datetime', '2026-11-12T10:00:00Z')

    const personality = results
      .getByRole('link', { name: 'Which Season Matches You?' })
      .closest('li')
    expect(personality).toHaveTextContent('Personality Winter')
    expect(personality).toHaveTextContent('Quiz updated')

    const deleted = results.getByRole('link', { name: 'Gone Quiz' }).closest('li')
    expect(deleted).toHaveTextContent('0 / 3')
    expect(deleted).toHaveTextContent('Quiz deleted')
    expect(within(deleted as HTMLElement).getAllByRole('link')).toHaveLength(1)
  })

  it('shows each quiz card with Edit and Delete named by its title', async () => {
    mocks.listQuizzes.mockImplementation(() => page([worldCapitals()]))
    await renderDashboard()

    const quizzes = section('My quizzes')
    expect(await quizzes.findByRole('link', { name: 'World Capitals' })).toHaveAttribute(
      'href',
      `/search?quiz=${id(1)}`,
    )
    expect(quizzes.getByText('Name the capital cities.')).toBeInTheDocument()
    expect(quizzes.getByRole('link', { name: 'Edit World Capitals' })).toHaveAttribute(
      'href',
      `/quizzes/${id(1)}/edit`,
    )
    expect(quizzes.getByRole('button', { name: 'Delete World Capitals' })).toBeInTheDocument()
    expect(quizzes.getByRole('link', { name: '+ Create quiz' })).toHaveAttribute(
      'href',
      '/quizzes/new',
    )
  })

  it('shows the empty states', async () => {
    await renderDashboard()

    expect(await section('My results').findByText(/No saved results yet\./)).toBeInTheDocument()
    expect(section('My results').getByRole('link', { name: 'Find a quiz' })).toHaveAttribute(
      'href',
      '/search',
    )
    expect(
      await section('My quizzes').findByText(/You haven't made a quiz yet\./),
    ).toBeInTheDocument()
    expect(section('My quizzes').getByRole('link', { name: 'Create one' })).toHaveAttribute(
      'href',
      '/quizzes/new',
    )
  })

  it('shows the error states, with uniquely named retry buttons', async () => {
    mocks.listResults.mockResolvedValue({ data: null, error: new Error('down') })
    mocks.listQuizzes.mockResolvedValue({ data: null, error: new Error('down') })
    await renderDashboard()

    expect(
      await section('My results').findByText("Couldn't load your results."),
    ).toBeInTheDocument()
    expect(
      await section('My quizzes').findByText("Couldn't load your quizzes."),
    ).toBeInTheDocument()

    mocks.listResults.mockImplementation(() => page([result(1)]))
    fireEvent.click(main().getByRole('button', { name: 'Try loading results again' }))
    expect(await section('My results').findByRole('link', { name: 'Result 1' })).toBeInTheDocument()
    expect(main().getByRole('button', { name: 'Try loading quizzes again' })).toBeInTheDocument()
  })

  it('shows more results, then moves focus to the first new row once none remain', async () => {
    mocks.listResults.mockImplementation(({ p_cursor }: { p_cursor?: unknown }) =>
      p_cursor ? page([result(3), result(4)]) : page([result(1), result(2)], CURSOR),
    )
    await renderDashboard()

    const button = await section('My results').findByRole('button', { name: 'Show more results' })
    button.focus()
    fireEvent.click(button)

    await waitFor(() =>
      expect(section('My results').getByRole('link', { name: 'Result 3' })).toHaveFocus(),
    )
    expect(
      section('My results').queryByRole('button', { name: /Show more/ }),
    ).not.toBeInTheDocument()
  })

  it('keeps focus on "Show more quizzes" while more pages remain', async () => {
    mocks.listQuizzes.mockImplementation(({ p_cursor }: { p_cursor?: unknown }) => {
      if (!p_cursor) return page([quiz(1, 'One')], CURSOR)
      if ((p_cursor as { id: string }).id === 'cursor') {
        return page([quiz(2, 'Two')], { ...CURSOR, id: 'cursor-2' })
      }
      return page([quiz(3, 'Three')])
    })
    await renderDashboard()

    const button = await section('My quizzes').findByRole('button', { name: 'Show more quizzes' })
    button.focus()
    fireEvent.click(button)
    await section('My quizzes').findByRole('link', { name: 'Two' })
    expect(button).toHaveFocus()

    fireEvent.click(button)
    await waitFor(() =>
      expect(section('My quizzes').getByRole('link', { name: 'Three' })).toHaveFocus(),
    )
  })

  it('deletes a quiz after confirming, then focuses My quizzes and announces it', async () => {
    mocks.listQuizzes.mockImplementation(() => page([worldCapitals(), quiz(2, 'Other')]))
    await renderDashboard()

    fireEvent.click(
      await section('My quizzes').findByRole('button', { name: 'Delete World Capitals' }),
    )
    const dialog = await waitFor(() => {
      const open = openDialog()
      if (!open) throw new Error('No open dialog')
      return open
    })
    expect(dialog).toHaveAccessibleName('Delete "World Capitals"?')
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()

    const resultsCalls = mocks.listResults.mock.calls.length
    mocks.listQuizzes.mockImplementation(() => page([quiz(2, 'Other')]))
    await act(async () =>
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete quiz' })),
    )

    await waitFor(() =>
      expect(section('My quizzes').getByRole('heading', { name: 'My quizzes' })).toHaveFocus(),
    )
    expect(dialog).not.toHaveAttribute('open')
    expect(
      section('My quizzes').queryByRole('link', { name: 'World Capitals' }),
    ).not.toBeInTheDocument()
    expect(mocks.deleteSelect).toHaveBeenCalledWith('id')
    await waitFor(() => expect(useAnnouncerStore.getState().message).toBe('Quiz deleted'))
    // My results are refreshed, so their rows can show "Quiz deleted".
    await waitFor(() => expect(mocks.listResults.mock.calls.length).toBeGreaterThan(resultsCalls))
  })

  it('keeps the dialog open with an error when a delete fails', async () => {
    mocks.listQuizzes.mockImplementation(() => page([worldCapitals()]))
    mocks.deleteSelect.mockResolvedValue({ data: null, error: new Error('nope') })
    await renderDashboard()

    fireEvent.click(
      await section('My quizzes').findByRole('button', { name: 'Delete World Capitals' }),
    )
    const dialog = await waitFor(() => {
      const open = openDialog()
      if (!open) throw new Error('No open dialog')
      return open
    })
    await act(async () =>
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete quiz' })),
    )

    expect(await within(dialog).findByRole('alert')).toHaveTextContent("Couldn't delete this quiz.")
    expect(dialog).toHaveAttribute('open')
    expect(section('My quizzes').getByRole('link', { name: 'World Capitals' })).toBeInTheDocument()
  })

  it('returns focus to the card that opened the popup when coming back', async () => {
    mocks.listQuizzes.mockImplementation(() => page([quiz(2, 'Other'), worldCapitals()]))
    const { router } = await renderDashboard()

    fireEvent.click(await section('My quizzes').findByRole('link', { name: 'World Capitals' }))
    await screen.findByRole('dialog', { name: 'World Capitals' })

    await act(async () => router.history.back())
    await waitFor(() => expect(screen.getByRole('link', { name: 'World Capitals' })).toHaveFocus())
  })

  it('focuses the heading when arriving without a recorded card', async () => {
    const { router } = await renderDashboard()
    await act(() => router.navigate({ to: '/search' }))
    await act(() => router.navigate({ to: '/dashboard' }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Your dashboard' })).toHaveFocus(),
    )
  })

  it('has no detectable accessibility violations', async () => {
    mocks.listResults.mockImplementation(() =>
      page([result(1, { quiz_status: 'updated' })], CURSOR),
    )
    mocks.listQuizzes.mockImplementation(() => page([worldCapitals()]))
    const { container } = await renderDashboard()
    await section('My quizzes').findByRole('link', { name: 'World Capitals' })
    await section('My results').findByRole('link', { name: 'Result 1' })

    expect(await axe(container)).toHaveNoViolations()
  })
})
