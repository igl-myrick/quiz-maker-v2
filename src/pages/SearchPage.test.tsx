import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { queryClient } from '../lib/queryClient'
import { routeTree } from '../routeTree.gen'
import type { QuizSummary, SearchResponse } from '../schemas/searchResult'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: vi.fn(),
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithOtp: vi.fn(),
      verifyOtp: vi.fn(),
      signOut: vi.fn(),
    },
  },
}))

function quiz(overrides: Partial<QuizSummary>): QuizSummary {
  return {
    id: crypto.randomUUID(),
    kind: 'trivia',
    title: 'A quiz',
    description: 'About something.',
    question_count: 3,
    suggested_time_seconds: null,
    ...overrides,
  }
}

function response(overrides: Partial<SearchResponse>): { data: SearchResponse; error: null } {
  return {
    data: { mode: 'browse', total: 0, items: [], next_cursor: null, ...overrides },
    error: null,
  }
}

const capitals = quiz({
  title: 'World Capitals',
  description: 'Capital cities.',
  question_count: 4,
  suggested_time_seconds: 300,
})
const seasons = quiz({ title: 'Which Season Matches You?', kind: 'personality' })

function renderApp(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  const view = render(<RouterProvider router={router} />)
  return { router, ...view }
}

describe('SearchPage', () => {
  beforeEach(() => {
    queryClient.clear()
    queryClient.setDefaultOptions({ queries: { retry: false } })
    mocks.rpc.mockReset()
    mocks.rpc.mockResolvedValue(response({ total: 2, items: [capitals, seasons] }))
  })

  it("lists every quiz with no query, with each card's details", async () => {
    renderApp('/search')

    expect(await screen.findByText('2 quizzes found')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'All quizzes' })).toBeInTheDocument()
    expect(mocks.rpc).toHaveBeenCalledWith('search_quizzes', {
      p_query: '',
      p_cursor: undefined,
      p_limit: 20,
    })

    const cards = within(screen.getByRole('main')).getAllByRole('listitem')
    expect(within(cards[0]).getByRole('link', { name: 'World Capitals' })).toBeInTheDocument()
    expect(within(cards[0]).getByText('Trivia')).toBeInTheDocument()
    expect(within(cards[0]).getByText(/4 questions · Suggested time: 5 min/)).toBeInTheDocument()
    expect(within(cards[0]).getByText('Capital cities.')).toBeInTheDocument()

    expect(within(cards[1]).getByText('Personality')).toBeInTheDocument()
    expect(within(cards[1]).queryByText(/Suggested time/)).not.toBeInTheDocument()
  })

  it('searches on submit by putting q in the URL', async () => {
    const { router } = renderApp('/search')
    await screen.findByText('2 quizzes found')
    mocks.rpc.mockResolvedValue(response({ mode: 'search', total: 1, items: [capitals] }))

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search quizzes' }), {
      target: { value: '  capital  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(await screen.findByText('1 quiz found')).toBeInTheDocument()
    expect(router.state.location.search).toEqual({ q: 'capital' })
    expect(
      screen.getByRole('heading', { level: 2, name: 'Results for "capital"' }),
    ).toBeInTheDocument()
    expect(mocks.rpc).toHaveBeenLastCalledWith('search_quizzes', {
      p_query: 'capital',
      p_cursor: undefined,
      p_limit: 20,
    })
  })

  it('asks for more specific words when the query has none', async () => {
    mocks.rpc.mockResolvedValue(response({ mode: 'no_terms' }))
    renderApp('/search?q=the%20of')

    expect(await screen.findByText('Try more specific words')).toHaveAttribute('role', 'status')
    expect(within(screen.getByRole('main')).queryByRole('list')).not.toBeInTheDocument()
  })

  it('says when nothing matches', async () => {
    mocks.rpc.mockResolvedValue(response({ mode: 'search', total: 0 }))
    renderApp('/search?q=zebra%20crossing')

    expect(await screen.findByText('No quizzes found')).toBeInTheDocument()
    expect(
      screen.getByText('No quizzes match "zebra crossing". Try different words.'),
    ).toBeInTheDocument()
  })

  it('shows an error with a working "Try again"', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: new Error('offline') })
    renderApp('/search')

    expect(await screen.findByText("Couldn't load quizzes.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('2 quizzes found')).toBeInTheDocument()
  })

  it('appends the next page with "Show more", then focuses the first new card', async () => {
    const third = quiz({ title: 'Amazing Animals' })
    mocks.rpc
      .mockResolvedValueOnce(
        response({
          total: 3,
          items: [capitals, seasons],
          next_cursor: { created_at: '2026-11-12T00:00:00Z', id: seasons.id },
        }),
      )
      .mockResolvedValueOnce(response({ total: 3, items: [third] }))
    renderApp('/search')

    expect(await screen.findByText('3 quizzes found, showing 2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }))

    expect(await screen.findByRole('link', { name: 'Amazing Animals' })).toBeInTheDocument()
    expect(within(screen.getByRole('main')).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('3 quizzes found')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
    expect(mocks.rpc).toHaveBeenLastCalledWith('search_quizzes', {
      p_query: '',
      p_cursor: { created_at: '2026-11-12T00:00:00Z', id: seasons.id },
      p_limit: 20,
    })
    await waitFor(() => expect(screen.getByRole('link', { name: 'Amazing Animals' })).toHaveFocus())
  })

  it('focuses the new page heading on a path change, but not on a search change', async () => {
    renderApp('/')
    fireEvent.click(await screen.findByRole('link', { name: 'Find a quiz' }))

    const heading = await screen.findByRole('heading', { level: 1, name: 'Find a quiz' })
    await waitFor(() => expect(heading).toHaveFocus())

    const box = screen.getByRole('searchbox', { name: 'Search quizzes' })
    act(() => box.focus())
    fireEvent.change(box, { target: { value: 'capital' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    await screen.findByRole('heading', { level: 2, name: 'Results for "capital"' })
    expect(heading).not.toHaveFocus()
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = renderApp('/search')
    await screen.findByText('2 quizzes found')

    expect(await axe(container)).toHaveNoViolations()
  })
})
