import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { queryClient } from '../lib/queryClient'
import { routeTree } from '../routeTree.gen'
import type { QuizSummary } from '../schemas/searchResult'

const capitals: QuizSummary = {
  id: 'a0000000-0000-4000-8000-000000000001',
  kind: 'trivia',
  title: 'World Capitals',
  description: 'Test your knowledge of capital cities around the world.',
  question_count: 4,
  suggested_time_seconds: 300,
}

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  maybeSingle: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }),
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithOtp: vi.fn(),
      verifyOtp: vi.fn(),
      signOut: vi.fn(),
    },
  },
}))

function renderApp(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  const view = render(<RouterProvider router={router} />)
  return { router, ...view }
}

function getDialog() {
  return screen.getByRole<HTMLDialogElement>('dialog')
}

describe('QuizDetailsDialog', () => {
  beforeEach(() => {
    queryClient.clear()
    queryClient.setDefaultOptions({ queries: { retry: false } })
    mocks.rpc.mockResolvedValue({
      data: { mode: 'search', total: 1, items: [capitals], next_cursor: null },
      error: null,
    })
    mocks.maybeSingle.mockResolvedValue({ data: capitals, error: null })
  })

  it('opens from a card link and closes back to the search, returning focus', async () => {
    const { router } = renderApp('/search?q=capital')
    const link = await screen.findByRole('link', { name: 'World Capitals' })

    link.focus()
    fireEvent.click(link)

    expect(
      await screen.findByRole('heading', { level: 2, name: 'World Capitals' }),
    ).toBeInTheDocument()
    expect(getDialog()).toHaveAttribute('open')
    expect(getDialog()).toHaveAccessibleName('World Capitals')
    expect(within(getDialog()).getByText('Suggested time: 5 min')).toBeInTheDocument()
    expect(within(getDialog()).getByText(capitals.description)).toBeInTheDocument()
    expect(router.state.location.search).toEqual({ q: 'capital', quiz: capitals.id })

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(router.state.location.search).toEqual({ q: 'capital' })
    await waitFor(() => expect(screen.getByRole('link', { name: 'World Capitals' })).toHaveFocus())
  })

  it('closes with Escape (the cancel event)', async () => {
    const { router } = renderApp('/search?q=capital')
    fireEvent.click(await screen.findByRole('link', { name: 'World Capitals' }))
    await screen.findByRole('heading', { level: 2, name: 'World Capitals' })

    fireEvent(getDialog(), new Event('cancel', { cancelable: true }))

    await waitFor(() => expect(router.state.location.search).toEqual({ q: 'capital' }))
  })

  it('shows a not-found state', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })
    renderApp(`/search?quiz=${capitals.id}`)

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Quiz not found' }),
    ).toBeInTheDocument()
    expect(screen.getByText('This quiz no longer exists.')).toBeInTheDocument()
  })

  it('replaces the history entry when closing a directly loaded popup', async () => {
    const { router } = renderApp(`/search?q=capital&quiz=${capitals.id}`)
    await screen.findByRole('heading', { level: 2, name: 'World Capitals' })
    const entriesBefore = router.history.length

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    await waitFor(() => expect(router.state.location.search).toEqual({ q: 'capital' }))
    expect(router.history.length).toBe(entriesBefore)
  })

  it('clears quiz from the URL when the dialog closes without a cancel event', async () => {
    const { router } = renderApp(`/search?quiz=${capitals.id}`)
    await screen.findByRole('heading', { level: 2, name: 'World Capitals' })

    // As when Chrome closes a dialog on a second Escape.
    getDialog().close()

    await waitFor(() => expect(router.state.location.search).toEqual({}))
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = renderApp(`/search?quiz=${capitals.id}`)
    await screen.findByRole('heading', { level: 2, name: 'World Capitals' })

    expect(await axe(container)).toHaveNoViolations()
  })
})
