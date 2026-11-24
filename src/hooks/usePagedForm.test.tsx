import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import { ErrorSummary } from '../components/ui/ErrorSummary'
import { useAnnouncerStore } from '../stores/announcerStore'
import { usePagedForm, type SummaryItem } from './usePagedForm'

const STEPS = ['one', 'two', 'three'] as const
type Step = (typeof STEPS)[number]

// Three steps, each with one field. A step passes its check once its field has text.
// The summary lists every empty field, or only the current step's after a step check.
function Harness({ serverMessage }: { serverMessage?: string }) {
  const [step, setStep] = useState<Step>('one')
  const [values, setValues] = useState<Record<Step, string>>({ one: '', two: '', three: '' })
  const { headingRef, summaryRef, ...form } = usePagedForm<Step>({
    steps: STEPS,
    current: step,
    goToStep: async (next) => setStep(next),
    describeStep: (s, index, total) => `Step ${index + 1} of ${total}: ${s}`,
  })

  const items: SummaryItem<Step>[] = STEPS.filter((s) => values[s] === '')
    .filter((s) => form.lastCheck !== 'step' || s === step)
    .map((s) => ({ key: s, step: s, targetId: `field-${s}`, text: `Fill in ${s}` }))

  return (
    <main>
      {form.lastCheck !== null && (items.length > 0 || serverMessage) && (
        <ErrorSummary
          summaryRef={summaryRef}
          heading={`Fix these (${form.lastCheck})`}
          headingLevel={2}
          items={items}
          onSelect={(item) => void form.selectItem(item)}
        >
          {serverMessage && <p>{serverMessage}</p>}
        </ErrorSummary>
      )}
      <h2 ref={headingRef} tabIndex={-1}>
        {form.stepHeading}
      </h2>
      <label htmlFor={`field-${step}`}>Field {step}</label>
      <input
        id={`field-${step}`}
        value={values[step]}
        onChange={(event) => setValues({ ...values, [step]: event.target.value })}
      />
      <button type="button" onClick={() => void form.back()}>
        Back
      </button>
      {/* Async, like the editor's check. */}
      <button type="button" onClick={() => void form.next(async () => values[step] !== '')}>
        Next
      </button>
      <button type="button" onClick={() => form.showSummary('finish')}>
        Finish
      </button>
    </main>
  )
}

function fill(step: Step) {
  fireEvent.change(screen.getByLabelText(`Field ${step}`), { target: { value: 'x' } })
}

// The summary appears one render after the request, as it does in the browser when
// React Hook Form's errors arrive after the editor asks for focus (change 12).
function LateSummary() {
  const [showErrors, setShowErrors] = useState(false)
  const { headingRef, summaryRef, showSummary } = usePagedForm({
    steps: ['only'] as const,
    current: 'only',
    goToStep: () => Promise.resolve(),
    describeStep: () => 'Step 1',
  })

  return (
    <>
      <h2 ref={headingRef} tabIndex={-1}>
        Step 1
      </h2>
      {showErrors && (
        <div ref={summaryRef} tabIndex={-1} role="group" aria-label="Problems">
          Problems
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          showSummary('finish')
          setTimeout(() => setShowErrors(true), 0)
        }}
      >
        Publish
      </button>
    </>
  )
}

describe('usePagedForm', () => {
  beforeEach(() => useAnnouncerStore.setState({ message: '' }))

  it('shows and focuses the summary when the step check fails', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    const summary = await screen.findByRole('group', { name: 'Fix these (step)' })
    await waitFor(() => expect(summary).toHaveFocus())
    // A step check lists only the current step's problems.
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['Fill in one'])
    expect(screen.getByRole('heading', { name: 'Step 1 of 3: one' })).toBeInTheDocument()
  })

  it('moves on when the check passes, focusing the heading and announcing it', async () => {
    render(<Harness />)
    fill('one')
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    const heading = await screen.findByRole('heading', { name: 'Step 2 of 3: two' })
    await waitFor(() => expect(heading).toHaveFocus())
    await waitFor(() => expect(useAnnouncerStore.getState().message).toBe('Step 2 of 3: two'))
  })

  it('goes back without checking, and hides the summary', async () => {
    render(<Harness />)
    fill('one')
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByRole('heading', { name: 'Step 2 of 3: two' })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByRole('group', { name: 'Fix these (step)' })

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    const heading = await screen.findByRole('heading', { name: 'Step 1 of 3: one' })
    await waitFor(() => expect(heading).toHaveFocus())
    // lastCheck resets when moving, so the summary goes away.
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
    await waitFor(() => expect(useAnnouncerStore.getState().message).toBe('Step 1 of 3: one'))
  })

  it('follows a summary link to another step and focuses its field', async () => {
    render(<Harness />)
    fill('one')
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }))
    const summary = await screen.findByRole('group', { name: 'Fix these (finish)' })
    await waitFor(() => expect(summary).toHaveFocus())

    fireEvent.click(screen.getByRole('link', { name: 'Fill in three' }))
    await waitFor(() => expect(screen.getByLabelText('Field three')).toHaveFocus())
    // The summary stays while the person fixes things.
    expect(screen.getByRole('group', { name: 'Fix these (finish)' })).toBeInTheDocument()
  })

  it('only focuses the field for a summary link on the same step', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByRole('group', { name: 'Fix these (step)' })
    fireEvent.click(screen.getByRole('link', { name: 'Fill in one' }))
    await waitFor(() => expect(screen.getByLabelText('Field one')).toHaveFocus())
    expect(screen.getByRole('heading', { name: 'Step 1 of 3: one' })).toBeInTheDocument()
  })

  it('shows a server message with no items and focuses it', async () => {
    render(<Harness serverMessage="Something went wrong." />)
    fill('one')
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByRole('heading', { name: 'Step 2 of 3: two' })
    fill('two')
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByRole('heading', { name: 'Step 3 of 3: three' })
    fill('three')

    fireEvent.click(screen.getByRole('button', { name: 'Finish' }))
    const summary = await screen.findByRole('group', { name: 'Fix these (finish)' })
    await waitFor(() => expect(summary).toHaveFocus())
    expect(summary).toHaveTextContent('Something went wrong.')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('has no detectable accessibility violations with the summary showing', async () => {
    const { container } = render(<Harness serverMessage="Something went wrong." />)
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }))
    await screen.findByRole('group')
    expect(await axe(container)).toHaveNoViolations()
  })
  it('focuses the summary even when it renders after the request', async () => {
    render(<LateSummary />)
    const publish = screen.getByRole('button', { name: 'Publish' })
    act(() => publish.focus())

    fireEvent.click(publish)
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)))

    expect(screen.getByRole('group', { name: 'Problems' })).toHaveFocus()
  })
})
