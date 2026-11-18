import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { PillGroup } from './PillGroup'

const sizes = [
  { value: 'default', label: 'Default' },
  { value: 'large', label: 'Large' },
]

describe('PillGroup', () => {
  it('is a named group of radios with the current value checked', () => {
    render(
      <PillGroup
        legend="Text size"
        name="size"
        options={sizes}
        value="large"
        onChange={() => {}}
      />,
    )
    expect(screen.getByRole('group', { name: 'Text size' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Large' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Default' })).not.toBeChecked()
  })

  it('reports the chosen value', () => {
    const onChange = vi.fn()
    render(
      <PillGroup
        legend="Text size"
        name="size"
        options={sizes}
        value="default"
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('radio', { name: 'Large' }))
    expect(onChange).toHaveBeenCalledWith('large')
  })

  it('checks only what value says, so the parent stays in control', () => {
    const { rerender } = render(
      <PillGroup
        legend="Text size"
        name="size"
        options={sizes}
        value="default"
        onChange={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('radio', { name: 'Large' }))
    expect(screen.getByRole('radio', { name: 'Default' })).toBeChecked()

    rerender(
      <PillGroup
        legend="Text size"
        name="size"
        options={sizes}
        value="large"
        onChange={() => {}}
      />,
    )
    expect(screen.getByRole('radio', { name: 'Large' })).toBeChecked()
  })

  it('keeps a hidden legend as the group name', () => {
    render(
      <PillGroup
        legend="Answer 2 points"
        name="p"
        options={sizes}
        value="default"
        onChange={() => {}}
        hideLegend
      />,
    )
    expect(screen.getByRole('group', { name: 'Answer 2 points' })).toBeInTheDocument()
  })

  it("hides its radios with Ply's sr-only class, keeping them focusable", () => {
    render(
      <PillGroup
        legend="Text size"
        name="size"
        options={sizes}
        value="large"
        onChange={() => {}}
      />,
    )
    expect(screen.getByRole('radio', { name: 'Large' })).toHaveClass('sr-only')
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = render(
      <PillGroup
        legend="Text size"
        name="size"
        options={sizes}
        value="large"
        onChange={() => {}}
      />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
