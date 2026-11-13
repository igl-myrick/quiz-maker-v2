import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { queryClient } from '../lib/queryClient'
import { routeTree } from '../routeTree.gen'
import type { TakeQuiz } from '../schemas/submission'
import { takeKey, useTakeStore } from '../stores/takeStore'

const QUIZ_ID = 'a0000000-0000-4000-8000-000000000001'

const quiz: TakeQuiz = {
  id: QUIZ_ID,
  version: 1,
  kind: 'trivia',
  title: 'World Capitals',
  suggested_time_seconds: 300,
  questions: [
    {
      id: '00000000-0000-4000-8000-000000000101',
      position: 1,
      type: 'single_choice',
      prompt: 'Capital of Japan?',
      options: [
        { id: '00000000-0000-4000-8000-000000000201', position: 1, label: 'Tokyo' },
        { id: '00000000-0000-4000-8000-000000000202', position: 2, label: 'Kyoto' },
      ],
    },
  ],
}

const mocks = vi.hoisted(() => ({ maybeSingle: vi.fn(), rpc: vi.fn() }))

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: () => ({
      select: (columns: string) => ({
        eq: () => ({ maybeSingle: () => mocks.maybeSingle(columns) }),
      }),
    }),
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }) },
  },
}))

async function openPopup() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [`/search?quiz=${QUIZ_ID}`] }),
  })
  const view = render(<RouterProvider router={router} />)
  const dialog = await screen.findByRole('dialog', { name: 'World Capitals' })
  return { router, dialog, ...view }
}

describe('StartQuizControls in the details popup', () => {
  beforeEach(() => {
    queryClient.clear()
    queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } })
    useTakeStore.setState({ takes: {} })
    mocks.rpc.mockResolvedValue({
      data: { mode: 'browse', total: 0, items: [], next_cursor: null },
      error: null,
    })
    mocks.maybeSingle.mockImplementation((columns: string) =>
      Promise.resolve({
        data: columns.includes('questions(')
          ? quiz
          : {
              id: QUIZ_ID,
              kind: 'trivia',
              title: 'World Capitals',
              description: '',
              question_count: 1,
              suggested_time_seconds: 300,
            },
        error: null,
      }),
    )
  })

  it('shows the timer switch with the suggested time, on by default', async () => {
    const { dialog } = await openPopup()

    const timer = within(dialog).getByRole('switch', { name: 'Timer' })
    expect(timer).toBeChecked()
    expect(within(dialog).getByText('Suggested time: 5 min')).toBeInTheDocument()
  })

  it('starts a timed take and opens the first page', async () => {
    const { dialog, router } = await openPopup()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Start quiz' }))

    await waitFor(() => expect(router.state.location.pathname).toBe(`/quizzes/${QUIZ_ID}/take`))
    const take = useTakeStore.getState().takes[takeKey(QUIZ_ID, 1)]
    expect(take.timed).toBe(true)
    expect(take.startedAt).toEqual(expect.any(Number))
  })

  it('asks before starting over, and offers to continue the take in progress', async () => {
    act(() => useTakeStore.getState().start(quiz, false))
    const { dialog, router } = await openPopup()

    expect(within(dialog).getByRole('link', { name: 'Continue your quiz' })).toHaveAttribute(
      'href',
      `/quizzes/${QUIZ_ID}/take?page=1`,
    )

    fireEvent.click(within(dialog).getByRole('button', { name: 'Start quiz' }))
    const confirm = await screen.findByRole('dialog', { name: 'Start over?' })
    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }))

    expect(router.state.location.pathname).toBe('/search')
    expect(mocks.maybeSingle).not.toHaveBeenCalledWith(expect.stringContaining('questions('))
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = await openPopup()
    expect(await axe(container)).toHaveNoViolations()
  })
})
