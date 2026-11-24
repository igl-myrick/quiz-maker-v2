import type { Session } from '@supabase/supabase-js'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { queryClient } from '../lib/queryClient'
import { routeTree } from '../routeTree.gen'
import type { QuizDraft, QuizFormInput, SavedQuiz } from '../schemas/quiz'
import { useAuthStore } from '../stores/authStore'

type AuthListener = (event: string, session: Session | null) => void

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  listener: null as AuthListener | null,
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
      }),
    }),
    auth: {
      onAuthStateChange: (listener: AuthListener) => {
        mocks.listener = listener
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      },
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
  },
}))

const QUIZ_ID = 'b1000000-0000-4000-8000-000000000001'
const member = { access_token: 'token', user: { id: 'u1' } } as unknown as Session

function option(label: string, isCorrect = false) {
  return { label, isCorrect, outcomeKey: '', points: '1' as const }
}

// A complete, valid trivia quiz.
function validTrivia(): QuizFormInput {
  const question = (prompt: string) => ({
    type: 'single_choice' as const,
    prompt,
    correctOption: '0',
    options: [option('Right'), option('Wrong')],
  })
  return {
    kind: 'trivia',
    title: 'Test Quiz',
    description: '',
    hasSuggestedTime: 'no',
    suggestedMinutes: '',
    outcomes: [],
    questions: [question('One?'), question('Two?'), question('Three?')],
  }
}

function personality(): QuizFormInput {
  return {
    ...validTrivia(),
    kind: 'personality',
    outcomes: [
      { key: 'cat', title: 'Cat', description: '' },
      { key: 'dog', title: 'Dog', description: '' },
    ],
    questions: [
      {
        type: 'single_choice',
        prompt: 'Pick one',
        correctOption: '',
        options: [
          { ...option('Nap'), outcomeKey: 'cat' },
          { ...option('Run'), outcomeKey: 'dog' },
        ],
      },
    ],
  }
}

function saveDraft(key: string, values: QuizFormInput, baseVersion: number | null = null) {
  const draft: QuizDraft = { baseVersion, values }
  sessionStorage.setItem(key, JSON.stringify(draft))
}

function savedQuiz(version = 1): SavedQuiz {
  return {
    id: QUIZ_ID,
    version,
    kind: 'trivia',
    title: 'Saved Quiz',
    description: '',
    suggested_time_seconds: null,
    outcomes: [],
    questions: [1, 2, 3].map((n) => ({
      type: 'single_choice' as const,
      prompt: `Saved ${n}?`,
      options: [
        { label: 'Yes', is_correct: true },
        { label: 'No', is_correct: false },
      ],
    })),
  }
}

async function renderApp(path: string, session: Session | null = member) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  const view = render(<RouterProvider router={router} />)
  act(() => mocks.listener?.('INITIAL_SESSION', session))
  await screen.findByRole('main')
  return { router, ...view }
}

function main() {
  return within(screen.getByRole('main'))
}

function getConfirmDialog() {
  return screen
    .getAllByRole('dialog', { hidden: true })
    .find((dialog) => dialog.hasAttribute('open'))
}

async function confirmDialog(label: string) {
  const dialog = await waitFor(() => {
    const open = getConfirmDialog()
    if (!open) throw new Error('No open dialog')
    return open
  })
  await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: label })))
}

function announced() {
  return document
    .querySelector('#root, body')
    ?.querySelector('div[aria-live="polite"][role="status"]')
}

describe('QuizEditorPage', () => {
  beforeEach(() => {
    sessionStorage.clear()
    queryClient.clear()
    queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } })
    useAuthStore.setState({ status: 'loading' }, true)
    mocks.rpc.mockReset()
    mocks.rpc.mockImplementation((name: string) => {
      if (name === 'get_quiz_for_edit') {
        return Promise.resolve({ data: { status: 'ok', quiz: savedQuiz() }, error: null })
      }
      if (name === 'save_quiz')
        return Promise.resolve({ data: { id: QUIZ_ID, version: 1 }, error: null })
      return Promise.resolve({
        data: { mode: 'browse', total: 0, items: [], next_cursor: null },
        error: null,
      })
    })
  })

  it('asks anonymous visitors to log in', async () => {
    await renderApp('/quizzes/new', null)

    expect(await main().findByText('Log in to create a quiz.')).toBeInTheDocument()
    expect(main().getByRole('button', { name: 'Log in' })).toBeInTheDocument()
    expect(main().queryByRole('heading', { level: 2 })).not.toBeInTheDocument()
  })

  it('checks a part before moving on, then moves focus to the next part and announces it', async () => {
    const { router } = await renderApp('/quizzes/new')
    await main().findByRole('heading', { name: 'Part 1 of 2: Basics' })

    fireEvent.click(main().getByRole('button', { name: 'Next' }))
    const summary = await main().findByRole('group', { name: 'Fix these before publishing' })
    expect(within(summary).getByRole('link', { name: /Title: Enter a title/ })).toBeInTheDocument()
    await waitFor(() => expect(summary).toHaveFocus())

    fireEvent.change(main().getByLabelText('Title'), { target: { value: 'My quiz' } })
    fireEvent.click(main().getByRole('button', { name: 'Next' }))

    const heading = await main().findByRole('heading', { name: 'Part 2 of 2: Questions' })
    await waitFor(() => expect(heading).toHaveFocus())
    expect(router.state.location.search).toEqual({ part: 'questions' })
    await waitFor(() => expect(announced()).toHaveTextContent('Part 2 of 2: Questions'))
  })

  it("doesn't let later parts block Next, and opens the next part with no errors", async () => {
    await renderApp('/quizzes/new')
    await main().findByRole('heading', { name: 'Part 1 of 2: Basics' })

    // The new quiz's question is empty too, but Next on Basics lists only Basics problems.
    fireEvent.click(main().getByRole('button', { name: 'Next' }))
    const summary = await main().findByRole('group', { name: 'Fix these before publishing' })
    expect(
      within(summary)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Title: Enter a title of at least 3 characters.'])

    fireEvent.change(main().getByLabelText('Title'), { target: { value: 'My quiz' } })
    fireEvent.click(main().getByRole('button', { name: 'Next' }))
    await main().findByRole('heading', { name: 'Part 2 of 2: Questions' })
    expect(main().queryByRole('group', { name: 'Fix these before publishing' })).toBeNull()
    expect(main().queryByText('Enter the question.')).toBeNull()
  })

  it('leaves "no answer leads here" to Publish, then shows it on the outcome name', async () => {
    const quiz = personality()
    quiz.questions = [1, 2, 3].map((n) => ({ ...quiz.questions[0], prompt: `Pick ${n}` }))
    quiz.outcomes.push({ key: 'fish', title: 'Fish', description: '' })
    saveDraft('quiz-draft:new', quiz)
    await renderApp('/quizzes/new?part=outcomes')
    await main().findByRole('heading', { name: 'Part 2 of 3: Outcomes' })

    fireEvent.click(main().getByRole('button', { name: 'Next' }))
    await main().findByRole('heading', { name: 'Part 3 of 3: Questions' })

    fireEvent.click(main().getByRole('button', { name: 'Publish' }))
    const summary = await main().findByRole('group', { name: 'Fix these before publishing' })
    fireEvent.click(
      within(summary).getByRole('link', {
        name: 'Outcome 3: No answer leads to this outcome yet.',
      }),
    )
    const name = await main().findByLabelText('Outcome 3 name')
    await waitFor(() => expect(name).toHaveFocus())
    expect(name).toHaveAccessibleDescription('No answer leads to this outcome yet.')
  })

  it('confirms before switching kind when kind-specific work would be lost', async () => {
    saveDraft('quiz-draft:new', validTrivia())
    await renderApp('/quizzes/new')
    await main().findByRole('heading', { name: 'Part 1 of 2: Basics' })

    fireEvent.click(main().getByRole('radio', { name: /Personality/ }))
    await waitFor(() => expect(getConfirmDialog()).toHaveAccessibleName('Switch to Personality?'))
    await confirmDialog('Cancel')
    expect(main().getByRole('radio', { name: /Trivia/ })).toBeChecked()

    fireEvent.click(main().getByRole('radio', { name: /Personality/ }))
    await confirmDialog('Switch to Personality')
    expect(main().getByRole('radio', { name: /Personality/ })).toBeChecked()
    expect(main().getByRole('heading', { name: 'Part 1 of 3: Basics' })).toBeInTheDocument()
  })

  it('shows step pills and turns purple once Personality is picked', async () => {
    await renderApp('/quizzes/new')
    await main().findByRole('heading', { name: 'Part 1 of 2: Basics' })

    const frame = document.querySelector('.editor-frame')
    expect(frame).not.toHaveAttribute('data-kind')
    expect(document.querySelector('.step-pills')).toHaveAttribute('aria-hidden', 'true')
    expect(document.querySelectorAll('.step-pills li')).toHaveLength(2)

    // A fresh form has no kind-specific work, so there's no confirm.
    fireEvent.click(main().getByRole('radio', { name: /Personality/ }))
    await waitFor(() => expect(frame).toHaveAttribute('data-kind', 'personality'))
    expect(document.querySelectorAll('.step-pills li')).toHaveLength(3)
  })

  it('puts Back and Discard on the left, Next and Publish on the right', async () => {
    saveDraft('quiz-draft:new', personality())
    await renderApp('/quizzes/new?part=outcomes')
    await main().findByRole('heading', { name: 'Part 2 of 3: Outcomes' })

    expect(document.querySelector('.editor-nav-start')).toHaveTextContent(/Back.*Discard draft/)
    expect(document.querySelector('.editor-nav-end')).toHaveTextContent(/Next.*Publish/)
  })

  it('puts Kind and Suggested time in matching panels, and counts beside the labels', async () => {
    const { unmount } = await renderApp('/quizzes/new')
    await main().findByRole('heading', { name: 'Part 1 of 2: Basics' })

    expect(main().getByRole('group', { name: 'Kind' })).toHaveClass('option-panel')
    const titleRow = main().getByText('Title', { selector: 'label' }).closest('.label-row')
    expect(titleRow).toHaveTextContent(/Title.*0\/75/)
    unmount()

    await renderApp('/quizzes/new?part=questions')
    await main().findByRole('heading', { name: 'Part 2 of 2: Questions' })
    expect(main().getByRole('group', { name: 'Suggested time' })).toHaveClass('option-panel')
  })

  it('shows each question as an outlined block with its tools in the header', async () => {
    await renderApp('/quizzes/new?part=questions')
    await main().findByRole('heading', { name: 'Part 2 of 2: Questions' })

    const block = main().getByRole('group', { name: 'Question 1' })
    expect(block).toHaveClass('editor-block')
    const moveUp = within(block).getByRole('button', { name: 'Move up: question 1' })
    expect(block.querySelector('.editor-block-tools')?.contains(moveUp)).toBe(true)
    expect(moveUp).toHaveAttribute('aria-disabled', 'true')
    expect(main().getByRole('button', { name: 'Add question' })).toHaveClass('add-slot')
  })

  it('shows each outcome as an outlined block, with Add outcome as a slot', async () => {
    saveDraft('quiz-draft:new', personality())
    await renderApp('/quizzes/new?part=outcomes')
    await main().findByRole('heading', { name: 'Part 2 of 3: Outcomes' })

    const block = main().getByRole('group', { name: 'Outcome 2' })
    expect(block).toHaveClass('editor-block')
    const moveDown = within(block).getByRole('button', { name: 'Move down: outcome 2' })
    expect(block.querySelector('.editor-block-tools')?.contains(moveDown)).toBe(true)
    expect(moveDown).toHaveAttribute('aria-disabled', 'true')
    expect(main().getByRole('button', { name: 'Add outcome' })).toHaveClass('add-slot')
  })

  it('lays personality answers out as a table with 1-2-3 points pills', async () => {
    saveDraft('quiz-draft:new', personality())
    await renderApp('/quizzes/new?part=questions')
    await main().findByRole('heading', { name: 'Part 3 of 3: Questions' })

    const answers = main().getByRole('group', { name: 'Answers to question 1' })
    expect(answers.querySelector('.answer-table-head')).toHaveAttribute('aria-hidden', 'true')
    expect(within(answers).getByLabelText('Answer 1 text')).toHaveValue('Nap')
    expect(within(answers).getByLabelText('Answer 1 leads to')).toHaveValue('cat')
    const points = within(answers).getByRole('group', { name: 'Answer 1 points' })
    expect(within(points).getByRole('radio', { name: '1' })).toBeChecked()
    fireEvent.click(within(points).getByRole('radio', { name: '3' }))
    expect(within(points).getByRole('radio', { name: '3' })).toBeChecked()
  })

  it("hides the table's per-answer labels with Ply's sr-only class in the wide layout", async () => {
    saveDraft('quiz-draft:new', personality())
    await renderApp('/quizzes/new?part=questions')
    await main().findByRole('heading', { name: 'Part 3 of 3: Questions' })

    expect(main().getByText('Answer 1 text', { selector: 'label' })).toHaveClass('sr-only')
    expect(main().getByText('Answer 1 leads to', { selector: 'label' })).toHaveClass('sr-only')
  })

  it('publishes the chosen points', async () => {
    const quiz = personality()
    quiz.questions = [1, 2, 3].map((n) => ({ ...quiz.questions[0], prompt: `Pick ${n}` }))
    saveDraft('quiz-draft:new', quiz)
    await renderApp('/quizzes/new?part=questions')
    await main().findByRole('heading', { name: 'Part 3 of 3: Questions' })

    const answers = main().getByRole('group', { name: 'Answers to question 1' })
    const points = within(answers).getByRole('group', { name: 'Answer 1 points' })
    fireEvent.click(within(points).getByRole('radio', { name: '3' }))
    fireEvent.click(main().getByRole('button', { name: 'Publish' }))

    await waitFor(() =>
      expect(mocks.rpc.mock.calls.some(([name]) => name === 'save_quiz')).toBe(true),
    )
    const [, args] = mocks.rpc.mock.calls.find(([name]) => name === 'save_quiz') ?? []
    expect(args.p_quiz.questions[0].options[0]).toMatchObject({ points: 3 })
    expect(args.p_quiz.questions[0].options[1]).toMatchObject({ points: 1 })
  })

  it('links the summary to an answer outcome inside the table', async () => {
    const quiz = personality()
    quiz.questions[0].options[0].outcomeKey = ''
    saveDraft('quiz-draft:new', quiz)
    await renderApp('/quizzes/new?part=questions')
    await main().findByRole('heading', { name: 'Part 3 of 3: Questions' })

    fireEvent.click(main().getByRole('button', { name: 'Publish' }))
    const summary = await main().findByRole('group', { name: 'Fix these before publishing' })
    fireEvent.click(within(summary).getByRole('link', { name: /answer 1: Choose an outcome/ }))
    await waitFor(() => expect(main().getByLabelText('Answer 1 leads to')).toHaveFocus())
  })

  it('adds, moves and removes questions, keeping focus and announcing each change', async () => {
    await renderApp('/quizzes/new?part=questions')
    await main().findByRole('heading', { name: 'Part 2 of 2: Questions' })

    fireEvent.click(main().getByRole('button', { name: 'Add question' }))
    await waitFor(() => expect(main().getByLabelText('Question 2 type')).toHaveFocus())

    fireEvent.change(main().getByLabelText('Question 1 text'), { target: { value: 'First' } })
    const moveDown = main().getByRole('button', { name: 'Move down: question 1' })
    fireEvent.click(moveDown)
    expect(main().getByLabelText('Question 2 text')).toHaveValue('First')
    expect(main().getByRole('button', { name: 'Move down: question 2' })).toHaveFocus()
    await waitFor(() => expect(announced()).toHaveTextContent('Question 1 moved to position 2'))

    // The question with text asks first; the empty one doesn't.
    fireEvent.click(main().getByRole('button', { name: 'Remove question 2' }))
    await confirmDialog('Remove question')
    expect(main().queryByLabelText('Question 2 text')).not.toBeInTheDocument()
    await waitFor(() => expect(announced()).toHaveTextContent('Question 2 removed'))
    expect(main().getByText('Question 1', { selector: 'legend' })).toHaveFocus()
    expect(main().getByRole('button', { name: 'Remove question 1' })).toBeDisabled()
  })

  it('adds and removes outcomes, warning when answers point to the one removed', async () => {
    saveDraft('quiz-draft:new', personality())
    await renderApp('/quizzes/new?part=outcomes')
    await main().findByRole('heading', { name: 'Part 2 of 3: Outcomes' })

    expect(main().getByRole('button', { name: 'Remove outcome 1' })).toBeDisabled()
    fireEvent.click(main().getByRole('button', { name: 'Add outcome' }))
    await waitFor(() => expect(main().getByLabelText('Outcome 3 name')).toHaveFocus())

    fireEvent.click(main().getByRole('button', { name: 'Remove outcome 1' }))
    await waitFor(() =>
      expect(getConfirmDialog()).toHaveAccessibleDescription(
        '1 answer points to this outcome and will need a new one.',
      ),
    )
    await confirmDialog('Remove outcome')
    expect(main().getAllByRole('group', { name: /^Outcome \d$/ })).toHaveLength(2)
    expect(main().getByLabelText('Outcome 1 name')).toHaveValue('Dog')
  })

  it('fills in True and False for a true/false question', async () => {
    await renderApp('/quizzes/new?part=questions')
    await main().findByRole('heading', { name: 'Part 2 of 2: Questions' })

    fireEvent.change(main().getByLabelText('Question 1 type'), { target: { value: 'true_false' } })

    expect(main().getByLabelText('Answer 1 text')).toHaveValue('True')
    expect(main().getByLabelText('Answer 2 text')).toHaveValue('False')
    expect(main().getByLabelText('Answer 1 text')).toHaveAttribute('readonly')
    expect(main().queryByLabelText('Number of answers for question 1')).not.toBeInTheDocument()
  })

  it('grows and shrinks the answers, confirming before removing text', async () => {
    await renderApp('/quizzes/new?part=questions')
    await main().findByRole('heading', { name: 'Part 2 of 2: Questions' })
    const count = main().getByLabelText('Number of answers for question 1')

    fireEvent.change(count, { target: { value: '4' } })
    expect(main().getByLabelText('Answer 4 text')).toBeInTheDocument()

    fireEvent.change(main().getByLabelText('Answer 4 text'), { target: { value: 'Keep me?' } })
    fireEvent.change(count, { target: { value: '2' } })
    await confirmDialog('Remove answers')
    expect(main().queryByLabelText('Answer 3 text')).not.toBeInTheDocument()
  })

  it('links summary items to fields in other parts', async () => {
    const { router } = await renderApp('/quizzes/new?part=questions')
    await main().findByRole('heading', { name: 'Part 2 of 2: Questions' })

    fireEvent.click(main().getByRole('button', { name: 'Publish' }))
    const summary = await main().findByRole('group', { name: 'Fix these before publishing' })
    expect(
      within(summary).getByRole('link', { name: 'This quiz needs at least 3 questions.' }),
    ).toBeInTheDocument()
    expect(
      within(summary).getByRole('link', { name: 'Question 1: Mark the correct answer.' }),
    ).toBeInTheDocument()

    fireEvent.click(within(summary).getByRole('link', { name: /Title: Enter a title/ }))
    await waitFor(() => expect(main().getByLabelText('Title')).toHaveFocus())
    expect(router.state.location.search).toEqual({ part: 'basics' })
    expect(main().getByLabelText('Title')).toHaveAccessibleDescription(/Enter a title/)
  })

  it('focuses the summary on the first Publish, so it scrolls into view', async () => {
    await renderApp('/quizzes/new?part=questions')
    await main().findByRole('heading', { name: 'Part 2 of 2: Questions' })

    // Like a real mouse click: the button takes focus first.
    const publish = main().getByRole('button', { name: 'Publish' })
    act(() => publish.focus())
    fireEvent.click(publish)

    const summary = await main().findByRole('group', { name: 'Fix these before publishing' })
    await waitFor(() => expect(summary).toHaveFocus())
    // Still focused once everything has settled.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(summary).toHaveFocus()
  })

  it('publishes, clears the draft and replaces the editor with the dashboard', async () => {
    saveDraft('quiz-draft:new', validTrivia())
    const { router } = await renderApp('/quizzes/new?part=questions')
    await waitFor(() => expect(announced()).toHaveTextContent('Restored your unsaved draft.'))
    const historyLength = router.history.length

    fireEvent.click(main().getByRole('button', { name: 'Publish' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'))
    expect(router.history.length).toBe(historyLength)
    expect(await main().findByText('Quiz created')).toBeInTheDocument()
    expect(sessionStorage.getItem('quiz-draft:new')).toBeNull()
    const [, args] = mocks.rpc.mock.calls.find(([name]) => name === 'save_quiz') ?? []
    expect(args.p_quiz).toMatchObject({ id: null, kind: 'trivia', title: 'Test Quiz' })
    await waitFor(() => expect(announced()).toHaveTextContent('Quiz created'))
  })

  it('saves changes and says so on the dashboard', async () => {
    const { router } = await renderApp(`/quizzes/${QUIZ_ID}/edit?part=questions`)
    await main().findByRole('heading', { name: 'Part 2 of 2: Questions' })

    fireEvent.click(main().getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'))
    expect(await main().findByText('Changes saved')).toBeInTheDocument()
    await waitFor(() => expect(announced()).toHaveTextContent('Changes saved'))
  })

  it.each([
    ['duplicate_title', 'You already have a quiz called "Test Quiz".'],
    ['rate_limited', "You've made a lot of quizzes recently. Try again in a little while."],
    ['something_else', 'Something went wrong. Your draft is saved. Try again.'],
  ])('shows the %s server error in the summary', async (code, message) => {
    mocks.rpc.mockImplementation((name: string) =>
      name === 'save_quiz'
        ? Promise.resolve({ data: null, error: { message: code, details: QUIZ_ID } })
        : Promise.resolve({
            data: { mode: 'browse', total: 0, items: [], next_cursor: null },
            error: null,
          }),
    )
    saveDraft('quiz-draft:new', validTrivia())
    await renderApp('/quizzes/new?part=questions')
    await main().findByRole('heading', { name: 'Part 2 of 2: Questions' })

    fireEvent.click(main().getByRole('button', { name: 'Publish' }))

    const summary = await main().findByRole('group', { name: 'Fix these before publishing' })
    expect(summary).toHaveTextContent(message)
    expect(sessionStorage.getItem('quiz-draft:new')).not.toBeNull()
    if (code === 'duplicate_title') {
      expect(within(summary).getByRole('link', { name: 'See your quiz' })).toHaveAttribute(
        'href',
        `/search?quiz=${QUIZ_ID}`,
      )
      await waitFor(() => expect(main().getByLabelText('Title')).toHaveFocus())
    }
  })

  it('shows the stale-version choice for a draft started on an older version', async () => {
    mocks.rpc.mockImplementation((name: string) =>
      name === 'get_quiz_for_edit'
        ? Promise.resolve({ data: { status: 'ok', quiz: savedQuiz(2) }, error: null })
        : Promise.resolve({ data: null, error: { message: 'stale_version', details: '' } }),
    )
    saveDraft(`quiz-draft:${QUIZ_ID}`, { ...validTrivia(), title: 'My edit' }, 1)
    await renderApp(`/quizzes/${QUIZ_ID}/edit`)

    const notice = await main().findByRole('alert')
    expect(notice).toHaveTextContent('This quiz changed since you opened it')
    expect(main().getByLabelText('Title')).toHaveValue('My edit')

    fireEvent.click(within(notice).getByRole('button', { name: 'Load the latest version' }))
    await confirmDialog('Load the latest version')

    await waitFor(() => expect(main().getByLabelText('Title')).toHaveValue('Saved Quiz'))
    expect(sessionStorage.getItem(`quiz-draft:${QUIZ_ID}`)).toBeNull()
  })

  it('discards the draft after confirming', async () => {
    saveDraft('quiz-draft:new', validTrivia())
    await renderApp('/quizzes/new')
    await waitFor(() => expect(main().getByLabelText('Title')).toHaveValue('Test Quiz'))

    fireEvent.click(main().getByRole('button', { name: 'Discard draft' }))
    await confirmDialog('Discard draft')

    await waitFor(() => expect(main().getByLabelText('Title')).toHaveValue(''))
    expect(sessionStorage.getItem('quiz-draft:new')).toBeNull()
  })

  it('shows the kind as text when editing, with no Delete (it lives on the dashboard)', async () => {
    await renderApp(`/quizzes/${QUIZ_ID}/edit`)
    await waitFor(() => expect(main().getByLabelText('Title')).toHaveValue('Saved Quiz'))
    expect(main().getByText(/Kind: Trivia/)).toBeInTheDocument()
    expect(main().queryByRole('radio', { name: /Personality/ })).not.toBeInTheDocument()
    expect(main().queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument()
  })

  it('says when the quiz belongs to someone else', async () => {
    mocks.rpc.mockResolvedValue({ data: { status: 'forbidden' }, error: null })
    await renderApp(`/quizzes/${QUIZ_ID}/edit`)

    expect(await main().findByText('You can only edit your own quizzes.')).toBeInTheDocument()
    expect(main().queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('has no detectable accessibility violations', async () => {
    saveDraft('quiz-draft:new', personality())
    const { container } = await renderApp('/quizzes/new?part=questions')
    await main().findByRole('heading', { name: 'Part 3 of 3: Questions' })

    expect(await axe(container)).toHaveNoViolations()
  })
})
