import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import { KindChip } from './KindChip'

describe('KindChip', () => {
  it('says Trivia for trivia quizzes', () => {
    render(<KindChip kind="trivia" />)
    expect(screen.getByText('Trivia')).toBeInTheDocument()
  })

  it('says Personality for personality quizzes', () => {
    render(<KindChip kind="personality" />)
    expect(screen.getByText('Personality')).toBeInTheDocument()
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = render(<KindChip kind="personality" />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
