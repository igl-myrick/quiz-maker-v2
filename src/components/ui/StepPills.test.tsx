import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import { StepPills } from './StepPills'

describe('StepPills', () => {
  it('is hidden from assistive technology', () => {
    const { container } = render(
      <StepPills steps={['Basics', 'Outcomes', 'Questions']} current={2} />,
    )
    expect(container.querySelector('ol')).toHaveAttribute('aria-hidden', 'true')
  })

  it('marks steps before, at and after the current one', () => {
    const { container } = render(
      <StepPills steps={['Basics', 'Outcomes', 'Questions']} current={2} />,
    )
    const states = [...container.querySelectorAll('li')].map((li) => li.dataset.state)
    expect(states).toEqual(['done', 'current', 'todo'])
  })

  it('shows each step name', () => {
    const { container } = render(<StepPills steps={['Basics', 'Questions']} current={1} />)
    expect(container).toHaveTextContent('Basics')
    expect(container).toHaveTextContent('Questions')
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = render(
      <StepPills steps={['Basics', 'Outcomes', 'Questions']} current={2} />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
