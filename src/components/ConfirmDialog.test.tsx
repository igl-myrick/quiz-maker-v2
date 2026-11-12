import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import { useConfirmDialog } from './ConfirmDialog'

let lastAnswer: boolean | null = null

function Harness() {
  const { confirm, dialog } = useConfirmDialog()
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          lastAnswer = await confirm({
            title: 'Delete "Capitals"?',
            body: "This can't be undone.",
            confirmLabel: 'Delete quiz',
          })
        }}
      >
        Open
      </button>
      {dialog}
    </>
  )
}

function getDialog() {
  return screen.getByRole<HTMLDialogElement>('dialog', { hidden: true })
}

describe('useConfirmDialog', () => {
  it('opens with its title and text, with Cancel focused first', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))

    expect(getDialog()).toHaveAttribute('open')
    expect(getDialog()).toHaveAccessibleName('Delete "Capitals"?')
    expect(getDialog()).toHaveAccessibleDescription("This can't be undone.")
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it('resolves true when confirmed and false when cancelled or closed', async () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Delete quiz' })))
    expect(lastAnswer).toBe(true)
    expect(getDialog()).not.toHaveAttribute('open')

    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Cancel' })))
    expect(lastAnswer).toBe(false)

    // Escape closes the dialog without a choice.
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    await act(async () => getDialog().close())
    expect(lastAnswer).toBe(false)
  })

  it('has no detectable accessibility violations when open', async () => {
    const { container } = render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))

    expect(await axe(container)).toHaveNoViolations()
  })
})
