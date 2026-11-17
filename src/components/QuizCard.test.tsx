import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import type { QuizSummary } from '../schemas/searchResult'
import { QuizCard, quizCardLinkId } from './QuizCard'

// The card only needs Link to render a plain link in these tests.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ id, children }: { id?: string; children: ReactNode }) => (
    <a href="/search" id={id}>
      {children}
    </a>
  ),
  useLocation: () => true,
  useRouter: () => ({ state: { location: { state: {} } } }),
}))

const quiz: QuizSummary = {
  id: 'a0000000-0000-4000-8000-000000000010',
  kind: 'trivia',
  title: 'World Capitals',
  description: 'Name them all.',
  question_count: 12,
  suggested_time_seconds: 300,
}

const actions = (
  <>
    <button type="button">Edit</button>
    <button type="button">Delete</button>
  </>
)

describe('QuizCard', () => {
  it('has exactly one link, named by the quiz title', () => {
    render(<QuizCard quiz={quiz} />)
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'World Capitals' })).toHaveAttribute(
      'id',
      quizCardLinkId(quiz.id),
    )
  })

  it('shows the kind, the description and the meta', () => {
    render(<QuizCard quiz={quiz} />)
    expect(screen.getByText('Trivia')).toBeInTheDocument()
    expect(screen.getByText('Name them all.')).toBeInTheDocument()
    expect(screen.getByText('12 questions')).toBeInTheDocument()
    expect(screen.getByText('Suggested time: 5 min')).toBeInTheDocument()
  })

  it('renders no description paragraph when there is none', () => {
    const { container } = render(<QuizCard quiz={{ ...quiz, description: '' }} />)
    expect(container.querySelector('.quiz-card-description')).toBeNull()
  })

  it('keeps actions as their own controls', () => {
    render(<QuizCard quiz={quiz} actions={actions} />)
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = render(<QuizCard quiz={quiz} actions={actions} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
