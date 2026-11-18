import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
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

function renderHome() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(<RouterProvider router={router} />)
}

describe('HomePage', () => {
  it('shows the site name, the description and a link to search', async () => {
    renderHome()

    expect(await screen.findByRole('heading', { level: 1, name: 'Quiz Maker' })).toBeInTheDocument()
    expect(screen.getByText('Take a quiz, see your result, and make your own.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Find a quiz' })).toHaveAttribute('href', '/search')
  })

  it('shows the cover art as decoration beside the text', async () => {
    const { container } = renderHome()
    await screen.findByRole('heading', { level: 1, name: 'Quiz Maker' })

    const art = container.querySelector('svg.cover-art')
    expect(art).not.toBeNull()
    expect(art).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('.home-hero')?.contains(art)).toBe(true)
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = renderHome()
    await screen.findByRole('heading', { level: 1, name: 'Quiz Maker' })

    expect(await axe(container)).toHaveNoViolations()
  })
})
