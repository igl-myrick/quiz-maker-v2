import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { SearchForm } from './SearchForm'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

describe('SearchForm', () => {
  it('keeps a visible label that names the search box', () => {
    render(<SearchForm q={undefined} />)
    expect(screen.getByText('Search quizzes')).not.toHaveClass('sr-only')
    expect(screen.getByRole('searchbox', { name: 'Search quizzes' })).toBeInTheDocument()
  })

  it('puts the box, a decorative icon and the Search button in one field', () => {
    const { container } = render(<SearchForm q="cap" />)
    const field = container.querySelector('.search-field')
    expect(field).not.toBeNull()
    expect(field?.contains(screen.getByRole('searchbox'))).toBe(true)
    expect(field?.contains(screen.getByRole('button', { name: 'Search' }))).toBe(true)
    expect(field?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = render(<SearchForm q={undefined} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
