import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import { HomePage } from './HomePage'

describe('HomePage', () => {
  it('shows the site name as the page heading', () => {
    render(<HomePage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Quiz Maker' })).toBeInTheDocument()
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = render(<HomePage />)

    expect(await axe(container)).toHaveNoViolations()
  })
})
