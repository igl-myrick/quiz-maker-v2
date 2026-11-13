import type { Session } from '@supabase/supabase-js'
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { queryClient } from '../lib/queryClient'
import { routeTree } from '../routeTree.gen'
import type { TakeQuiz } from '../schemas/submission'
import { useAnnouncerStore } from '../stores/announcerStore'
import { useAuthStore } from '../stores/authStore'
import { takeKey, useTakeStore, type Take } from '../stores/takeStore'

type AuthListener = (event: string, session: Session | null) => void

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  rpc: vi.fn(),
  maybeSingle: vi.fn(),
  listener: null as AuthListener | null,
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    functions: { invoke: mocks.invoke },
    rpc: mocks.rpc,
    from: () => ({
      select: (columns: string) => ({
        eq: () => ({ maybeSingle: () => mocks.maybeSingle(columns) }),
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

const QUIZ_ID = 'a0000000-0000-4000-8000-000000000001'
const RESULT_ID = 'c0000000-0000-4000-8000-000000000001'

function uuid(n: number) {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

// A 12-question quiz: two pages of 10 and 2.
function takeQuiz(version = 1, prompt = (n: number) => `Question text ${n}`): TakeQuiz {
  return {
    id: QUIZ_ID,
    version,
    kind: 'trivia',
    title: 'Capitals',
    suggested_time_seconds: 300,
    questions: Array.from({ length: 12 }, (_, i) => ({
      id: uuid(100 + i),
      position: i + 1,
      type: i === 11 ? ('multi_select' as const) : ('single_choice' as const),
      prompt: prompt(i + 1),
      options: [
        { id: uuid(1000 + i * 10), position: 1, label: `Yes ${i + 1}` },
        { id: uuid(1000 + i * 10 + 1), position: 2, label: `No ${i + 1}` },
      ],
    })),
  }
}

function seedTake(take: Partial<Take> = {}) {
  const quiz = take.quiz ?? takeQuiz()
  useTakeStore.setState({
    takes: {
      [takeKey(quiz.id, quiz.version)]: {
        quiz,
        timed: false,
        startedAt: null,
        answers: {},
        ...take,
      },
    },
  })
}

function answerAll(from: number, to: number) {
  const key = takeKey(QUIZ_ID, 1)
  for (let i = from; i <= to; i++) {
    useTakeStore.getState().setAnswer(key, uuid(99 + i), [uuid(1000 + (i - 1) * 10)])
  }
}

async function renderApp(path: string, session: Session | null = null) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  const view = render(<RouterProvider router={router} />)
  act(() => mocks.listener?.('INITIAL_SESSION', session))
  await screen.findByRole('main')
  return { router, ...view }
}

function main() {
  return within(screen.getByRole('main'))
}

function announced() {
  return document.querySelector('div[aria-live="polite"][role="status"]')
}

function httpError(status: number, body: Record<string, unknown>) {
  return {
    data: null,
    error: new FunctionsHttpError(new Response(JSON.stringify(body), { status })),
  }
}

describe('TakePage', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    queryClient.clear()
    queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } })
    useAuthStore.setState({ status: 'loading' }, true)
    useTakeStore.setState({ takes: {} })
    useAnnouncerStore.setState({ message: '' })
    mocks.invoke.mockReset()
    mocks.rpc.mockReset().mockResolvedValue({ data: { status: 'not_found' }, error: null })
    mocks.maybeSingle.mockReset()
  })

  it('shows 10 questions per page as labelled radio groups, with progress', async () => {
    seedTake()
    await renderApp(`/quizzes/${QUIZ_ID}/take`)

    expect(main().getByRole('heading', { level: 2, name: 'Page 1 of 2' })).toBeInTheDocument()
    expect(main().getAllByRole('group', { name: /^Question \d+ of 12/ })).toHaveLength(10)
    const first = main().getByRole('group', { name: 'Question 1 of 12: Question text 1' })
    expect(within(first).getByRole('radio', { name: 'Yes 1' })).not.toBeChecked()
    expect(main().getByText('0 of 12 answered')).toBeInTheDocument()

    fireEvent.click(within(first).getByRole('radio', { name: 'Yes 1' }))
    expect(within(first).getByRole('radio', { name: 'Yes 1' })).toBeChecked()
    expect(main().getByText('1 of 12 answered')).toBeInTheDocument()
  })

  it('needs every question on a page answered before moving on, then focuses and announces the next page', async () => {
    seedTake()
    const { router } = await renderApp(`/quizzes/${QUIZ_ID}/take`)

    fireEvent.click(main().getByRole('button', { name: 'Next page' }))
    const summary = await main().findByRole('group', { name: 'Answer these questions to continue' })
    expect(within(summary).getAllByRole('link')).toHaveLength(10)
    await waitFor(() => expect(summary).toHaveFocus())

    act(() => answerAll(1, 10))
    expect(
      main().queryByRole('group', { name: 'Answer these questions to continue' }),
    ).not.toBeInTheDocument()

    fireEvent.click(main().getByRole('button', { name: 'Next page' }))
    const heading = await main().findByRole('heading', { level: 2, name: 'Page 2 of 2' })
    await waitFor(() => expect(heading).toHaveFocus())
    expect(router.state.location.search).toEqual({ page: 2 })
    await waitFor(() => expect(announced()).toHaveTextContent('Page 2 of 2'))
    expect(main().getByText('Choose all that apply')).toBeInTheDocument()
  })

  it('checks every page on submit, and links to questions on other pages', async () => {
    seedTake()
    const { router } = await renderApp(`/quizzes/${QUIZ_ID}/take?page=2`)
    act(() => answerAll(2, 12))

    fireEvent.click(main().getByRole('button', { name: 'Submit answers' }))
    const summary = await main().findByRole('group', {
      name: 'Answer these questions before submitting',
    })
    fireEvent.click(within(summary).getByRole('link', { name: 'Question 1: Question text 1' }))

    await waitFor(() => expect(router.state.location.search).toEqual({ page: 1 }))
    await waitFor(() => expect(main().getByRole('radio', { name: 'Yes 1' })).toHaveFocus())
    expect(mocks.invoke).not.toHaveBeenCalled()
  })

  it('shows the last page for a page number past the end', async () => {
    seedTake()
    const { router } = await renderApp(`/quizzes/${QUIZ_ID}/take?page=9`)
    await waitFor(() => expect(router.state.location.search).toEqual({ page: 2 }))
  })

  it('restores the take from session storage, using its own copy of the quiz', async () => {
    const key = takeKey(QUIZ_ID, 1)
    sessionStorage.setItem(
      'quiz-takes',
      JSON.stringify({
        state: {
          takes: {
            [key]: {
              quiz: takeQuiz(1, (n) => `Original question ${n}`),
              timed: false,
              startedAt: null,
              answers: { [uuid(100)]: [uuid(1001)] },
            },
          },
        },
        version: 0,
      }),
    )
    await act(() => useTakeStore.persist.rehydrate())
    // If the page fetched the live quiz, it would get this edited version instead.
    mocks.maybeSingle.mockResolvedValue({
      data: takeQuiz(2, (n) => `Edited question ${n}`),
      error: null,
    })

    await renderApp(`/quizzes/${QUIZ_ID}/take`)

    expect(
      main().getByRole('group', { name: 'Question 1 of 12: Original question 1' }),
    ).toBeInTheDocument()
    expect(main().getByRole('radio', { name: 'No 1' })).toBeChecked()
    expect(mocks.maybeSingle).not.toHaveBeenCalled()
  })

  it('shows the countdown for a timed take', async () => {
    seedTake({ timed: true, startedAt: Date.now() - 10_000 })
    await renderApp(`/quizzes/${QUIZ_ID}/take`)

    expect(main().getByText(/Time left: 4:50/)).toBeInTheDocument()
  })

  it('submits, keeps the claim token, clears the take and opens the result', async () => {
    seedTake({ timed: true, startedAt: Date.parse('2026-11-12T10:00:00Z') })
    answerAll(1, 12)
    mocks.invoke.mockResolvedValue({
      data: { result_id: RESULT_ID, claim_token: 'token-123' },
      error: null,
    })
    const { router } = await renderApp(`/quizzes/${QUIZ_ID}/take?page=2`)

    fireEvent.click(main().getByRole('button', { name: 'Submit answers' }))

    await waitFor(() => expect(router.state.location.pathname).toBe(`/results/${RESULT_ID}`))
    const [name, { body }] = mocks.invoke.mock.calls[0]
    expect(name).toBe('submit-quiz')
    expect(body).toMatchObject({
      quiz_id: QUIZ_ID,
      quiz_version: 1,
      timed: true,
      started_at: '2026-11-12T10:00:00.000Z',
    })
    expect(Object.keys(body.answers)).toHaveLength(12)
    expect(JSON.parse(localStorage.getItem(`claim:${RESULT_ID}`) ?? '{}').token).toBe('token-123')
    await waitFor(() => expect(useTakeStore.getState().takes).toEqual({}))
  })

  it.each([
    [
      'logged out (401)',
      httpError(401, { code: 'unauthorized' }),
      "You've been logged out. Log in to submit.",
    ],
    [
      'quiz changed (409)',
      httpError(409, { code: 'quiz_changed' }),
      "This quiz changed more than a day after you started, so these answers can't be graded.",
    ],
    ['quiz deleted (410)', httpError(410, { code: 'quiz_deleted' }), 'This quiz no longer exists.'],
    [
      'invalid answers (422)',
      httpError(422, { code: 'invalid_answers' }),
      "Something about these answers didn't match the quiz. Please start again.",
    ],
    [
      'rate limited, anonymous (429)',
      httpError(429, { code: 'rate_limited' }),
      'Too many quizzes have been sent from this internet connection in the last hour.',
    ],
    [
      'server error (500)',
      httpError(500, { code: 'server_error' }),
      "Couldn't submit. Check your connection and try again.",
    ],
    [
      'network failure',
      { data: null, error: new FunctionsFetchError(new Error('offline')) },
      "Couldn't submit. Check your connection and try again.",
    ],
  ])('shows the %s error and keeps the answers', async (_label, response, message) => {
    seedTake()
    answerAll(1, 12)
    mocks.invoke.mockResolvedValue(response)
    await renderApp(`/quizzes/${QUIZ_ID}/take?page=2`)

    fireEvent.click(main().getByRole('button', { name: 'Submit answers' }))

    const summary = await main().findByRole('group', { name: "Couldn't submit your answers" })
    expect(summary).toHaveTextContent(message)
    await waitFor(() => expect(summary).toHaveFocus())
    expect(Object.keys(useTakeStore.getState().takes)).toHaveLength(1)
    if (message.startsWith('This quiz changed') || message.startsWith('Something about')) {
      expect(
        within(summary).getByRole('button', { name: 'Start the current version' }),
      ).toBeInTheDocument()
    }
  })

  it('uses the member message for a member who hits the limit', async () => {
    seedTake()
    answerAll(1, 12)
    mocks.invoke.mockResolvedValue(httpError(429, { code: 'rate_limited' }))
    await renderApp(`/quizzes/${QUIZ_ID}/take?page=2`, { access_token: 't' } as unknown as Session)

    fireEvent.click(main().getByRole('button', { name: 'Submit answers' }))

    expect(
      await main().findByRole('group', { name: "Couldn't submit your answers" }),
    ).toHaveTextContent("You've submitted a lot of quizzes in the last hour.")
  })

  it('lists the questions the server says are unanswered', async () => {
    seedTake()
    answerAll(1, 12)
    mocks.invoke.mockResolvedValue(
      httpError(422, { code: 'unanswered', question_ids: [uuid(100)] }),
    )
    await renderApp(`/quizzes/${QUIZ_ID}/take?page=2`)
    // The server disagrees with the browser about question 1.
    act(() => useTakeStore.getState().setAnswer(takeKey(QUIZ_ID, 1), uuid(100), []))
    act(() => answerAll(2, 12))

    fireEvent.click(main().getByRole('button', { name: 'Submit answers' }))

    const summary = await main().findByRole('group', {
      name: 'Answer these questions before submitting',
    })
    expect(
      within(summary).getByRole('link', { name: 'Question 1: Question text 1' }),
    ).toBeInTheDocument()
  })

  it('offers to start when there is no take in this tab', async () => {
    mocks.maybeSingle.mockImplementation((columns: string) =>
      Promise.resolve({
        data: columns.includes('questions(')
          ? takeQuiz()
          : {
              id: QUIZ_ID,
              kind: 'trivia',
              title: 'Capitals',
              description: '',
              question_count: 12,
              suggested_time_seconds: 300,
            },
        error: null,
      }),
    )
    const { router } = await renderApp(`/quizzes/${QUIZ_ID}/take`)

    expect(await main().findByRole('heading', { level: 1, name: 'Capitals' })).toBeInTheDocument()
    const timer = main().getByRole('switch', { name: 'Timer' })
    expect(timer).toHaveAttribute('aria-checked', 'true')
    expect(timer).toHaveTextContent('Timer enabled')
    fireEvent.click(timer)
    expect(timer).toHaveAttribute('aria-checked', 'false')
    expect(timer).toHaveTextContent('Timer disabled')

    fireEvent.click(main().getByRole('button', { name: 'Start quiz' }))

    await main().findByRole('heading', { level: 2, name: 'Page 1 of 2' })
    const take = useTakeStore.getState().takes[takeKey(QUIZ_ID, 1)]
    expect(take).toMatchObject({ timed: false, startedAt: null, answers: {} })
    expect(take.quiz.questions).toHaveLength(12)
    expect(router.state.location.search).toEqual({ page: 1 })
  })

  it('says when the quiz no longer exists', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })
    await renderApp(`/quizzes/${QUIZ_ID}/take`)

    expect(await main().findByText('This quiz no longer exists.')).toBeInTheDocument()
    expect(main().getByRole('link', { name: 'Find another quiz' })).toHaveAttribute(
      'href',
      '/search',
    )
  })

  it('has no detectable accessibility violations', async () => {
    seedTake({ timed: true, startedAt: Date.now() })
    const { container } = await renderApp(`/quizzes/${QUIZ_ID}/take?page=2`)

    expect(await axe(container)).toHaveNoViolations()
  })
})
