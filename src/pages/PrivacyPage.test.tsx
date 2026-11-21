import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { routeTree } from '../routeTree.gen'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

function renderAt(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  return { router, ...render(<RouterProvider router={router} />) }
}

const SECTIONS = [
  "If you don't log in",
  'If you log in',
  'What a result contains',
  "What's kept in your browser",
  'Who else handles your data',
  'Deleting your data',
  'Questions',
]

describe('PrivacyPage', () => {
  it('has one Privacy heading and a heading for each section', async () => {
    renderAt('/privacy')

    expect(await screen.findByRole('heading', { level: 1, name: 'Privacy' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(SECTIONS)
  })

  it('shows when it was last updated', async () => {
    renderAt('/privacy')

    await screen.findByRole('heading', { level: 1, name: 'Privacy' })
    const time = screen.getByText('November 20, 2026')
    expect(time.tagName).toBe('TIME')
    expect(time).toHaveAttribute('datetime', '2026-11-20')
  })

  it('links to GitHub issues for questions, with a name that says where it goes', async () => {
    renderAt('/privacy')

    const link = await screen.findByRole('link', {
      name: 'github.com/igl-myrick/quiz-maker-v2/issues',
    })
    expect(link).toHaveAttribute('href', 'https://github.com/igl-myrick/quiz-maker-v2/issues')
  })

  it('sets the page title', async () => {
    renderAt('/privacy')

    await screen.findByRole('heading', { level: 1, name: 'Privacy' })
    await vi.waitFor(() => expect(document.title).toBe('Privacy · Quiz Maker'))
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = renderAt('/privacy')

    await screen.findByRole('heading', { level: 1, name: 'Privacy' })
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('site footer', () => {
  it('links to the privacy page from every page, after the main content', async () => {
    const { router } = renderAt('/')

    await screen.findByRole('heading', { level: 1, name: 'Quiz Maker' })
    const footer = screen.getByRole('contentinfo')
    const link = within(footer).getByRole('link', { name: 'Privacy' })
    expect(link).toHaveAttribute('href', '/privacy')
    expect(
      screen.getByRole('main').compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    fireEvent.click(link)
    expect(await screen.findByRole('heading', { level: 1, name: 'Privacy' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/privacy')
  })
})
