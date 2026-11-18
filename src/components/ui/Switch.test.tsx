import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { Switch } from './Switch'

describe('Switch', () => {
  it('is a switch named by its label and reports its state', () => {
    render(<Switch checked label="Timer on" onChange={() => {}} />)
    expect(screen.getByRole('switch', { name: 'Timer on' })).toHaveAttribute('aria-checked', 'true')
  })

  it('uses ariaLabel as its name when given', () => {
    render(<Switch checked={false} label="Timer off" ariaLabel="Timer" onChange={() => {}} />)
    expect(screen.getByRole('switch', { name: 'Timer' })).toHaveAttribute('aria-checked', 'false')
  })

  it('asks for the opposite state when clicked', () => {
    const onChange = vi.fn()
    render(<Switch checked label="Timer on" onChange={onChange} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = render(<Switch checked label="Timer on" onChange={() => {}} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
