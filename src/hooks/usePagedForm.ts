import { useEffect, useRef, useState } from 'react'
import { announce } from '../stores/announcerStore'

// Which check last stopped the person: one step (Next) or the whole form (Submit, Publish).
export type Check = 'step' | 'finish'

// One problem in the error summary: its text, the step that holds it and the element
// to focus. The caller works out the step and the target.
export type SummaryItem<Step> = {
  key: string
  step: Step
  targetId: string
  text: string
}

type FocusTarget<Step> =
  | { step: Step; kind: 'heading' }
  | { step: Step; kind: 'summary' }
  | { step: Step; kind: 'element'; id: string }

type PagedFormOptions<Step> = {
  // The steps in order, and the one showing (read from the caller's URL).
  steps: readonly Step[]
  current: Step
  // Change the URL to show a step. The caller does its own typed navigate.
  goToStep: (step: Step) => Promise<void>
  // The step heading, also announced after moving, such as "Page 2 of 3".
  describeStep: (step: Step, index: number, total: number) => string
}

// The flow shared by the take and the quiz editor: moving between steps, checking a step
// before Next, and the error summary. The caller decides what is wrong and what to submit.
// Destructure headingRef and summaryRef from the result: React's lint otherwise treats the
// whole result as a ref and flags reading stepHeading during render.
export function usePagedForm<Step extends string | number>({
  steps,
  current,
  goToStep,
  describeStep,
}: PagedFormOptions<Step>) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const [lastCheck, setLastCheck] = useState<Check | null>(null)

  // What to focus once it has rendered. Kept in a ref and focused by the effect below;
  // the counter makes sure a render follows every request.
  const pendingFocus = useRef<FocusTarget<Step> | null>(null)
  const [, setFocusRequests] = useState(0)

  function requestFocus(target: FocusTarget<Step>) {
    pendingFocus.current = target
    setFocusRequests((count) => count + 1)
  }

  // Runs after every render. Waits until the target's step is showing and the target
  // itself has rendered: the error summary can appear a render after it is asked for,
  // when the form's errors arrive later (change 12). A newer request replaces this one.
  useEffect(() => {
    const target = pendingFocus.current
    if (target === null || target.step !== current) return
    const element =
      target.kind === 'heading'
        ? headingRef.current
        : target.kind === 'summary'
          ? summaryRef.current
          : document.getElementById(target.id)
    if (!element) return
    pendingFocus.current = null
    element.focus()
  })

  const index = steps.indexOf(current)

  async function goTo(step: Step) {
    setLastCheck(null)
    requestFocus({ step, kind: 'heading' })
    await goToStep(step)
    announce(describeStep(step, steps.indexOf(step), steps.length))
  }

  // Show the summary and focus it. Focusing it reads it out, so there's no announcement.
  function showSummary(check: Check) {
    setLastCheck(check)
    requestFocus({ step: current, kind: 'summary' })
  }

  // Next: move on if the current step passes its check, otherwise show the summary.
  async function next(check: () => boolean | Promise<boolean>) {
    if (!(await check())) {
      showSummary('step')
      return
    }
    await goTo(steps[index + 1])
  }

  // A summary link: show the step that holds the problem, then focus its field.
  async function selectItem(item: SummaryItem<Step>) {
    requestFocus({ step: item.step, kind: 'element', id: item.targetId })
    if (item.step !== current) await goToStep(item.step)
  }

  return {
    stepHeading: describeStep(current, index, steps.length),
    headingRef,
    summaryRef,
    lastCheck,
    next,
    back: () => goTo(steps[index - 1]),
    goTo,
    showSummary,
    selectItem,
  }
}
