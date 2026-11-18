import { fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { ErrorSummary } from './ErrorSummary'

const items = [
  { key: 'a', targetId: 'field-a', text: 'Title: Enter a title.' },
  { key: 'b', targetId: 'field-b', text: 'Question 1: Enter the question.' },
]

describe('ErrorSummary', () => {
  it('is a group named by its heading, at the level asked for', () => {
    render(
      <ErrorSummary
        summaryRef={createRef()}
        heading="Fix these before publishing"
        headingLevel={3}
        items={items}
        onSelect={() => {}}
      />,
    )
    expect(screen.getByRole('group', { name: 'Fix these before publishing' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(
      'Fix these before publishing',
    )
  })

  it('puts the server message above the list', () => {
    render(
      <ErrorSummary
        summaryRef={createRef()}
        heading="Couldn't submit"
        headingLevel={2}
        items={items}
        onSelect={() => {}}
      >
        <p>Something went wrong.</p>
      </ErrorSummary>,
    )
    const message = screen.getByText('Something went wrong.')
    const list = screen.getByRole('list')
    expect(message.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('leaves the list out when there are no items', () => {
    render(
      <ErrorSummary
        summaryRef={createRef()}
        heading="Couldn't submit"
        headingLevel={2}
        items={[]}
        onSelect={() => {}}
      >
        <p>Something went wrong.</p>
      </ErrorSummary>,
    )
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('reports the chosen item instead of following the link', () => {
    const onSelect = vi.fn()
    render(
      <ErrorSummary
        summaryRef={createRef()}
        heading="Fix these"
        headingLevel={2}
        items={items}
        onSelect={onSelect}
      />,
    )
    const link = screen.getByRole('link', { name: 'Question 1: Enter the question.' })
    expect(link).toHaveAttribute('href', '#field-b')
    fireEvent.click(link)
    expect(onSelect).toHaveBeenCalledWith(items[1])
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = render(
      <ErrorSummary
        summaryRef={createRef()}
        heading="Fix these"
        headingLevel={2}
        items={items}
        onSelect={() => {}}
      >
        <p>Something went wrong.</p>
      </ErrorSummary>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
