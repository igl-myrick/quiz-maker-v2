import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import { QuizMeta } from './QuizMeta'

describe('QuizMeta', () => {
  it("shows the question count and suggested time in today's words", () => {
    render(<QuizMeta questionCount={4} suggestedTimeSeconds={300} />)
    expect(screen.getByText('4 questions')).toBeInTheDocument()
    expect(screen.getByText('Suggested time: 5 min')).toBeInTheDocument()
  })

  it('leaves the time out when there is no suggested time', () => {
    render(<QuizMeta questionCount={8} suggestedTimeSeconds={null} />)
    expect(screen.getByText('8 questions')).toBeInTheDocument()
    expect(screen.queryByText(/Suggested time/)).not.toBeInTheDocument()
  })

  it('hides its icons from assistive technology', () => {
    const { container } = render(<QuizMeta questionCount={4} suggestedTimeSeconds={300} />)
    const icons = container.querySelectorAll('svg')
    expect(icons).toHaveLength(2)
    for (const svg of icons) {
      expect(svg).toHaveAttribute('aria-hidden', 'true')
      expect(svg).toHaveAttribute('focusable', 'false')
    }
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = render(<QuizMeta questionCount={4} suggestedTimeSeconds={300} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
