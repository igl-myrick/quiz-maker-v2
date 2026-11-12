import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate } from '@tanstack/react-router'
import { useRef, useState, type FormEvent } from 'react'
import { FormProvider, useForm, useWatch, type FieldPath } from 'react-hook-form'
import { quizForEditQuery } from '../../hooks/useQuizForEdit'
import {
  quizDraftKey,
  readQuizDraft,
  removeQuizDraft,
  useQuizDraftWriter,
} from '../../hooks/useQuizDraft'
import { SaveQuizError, useSaveQuiz } from '../../hooks/useSaveQuiz'
import {
  emptyQuizValues,
  fromSavedQuiz,
  quizFormSchema,
  toSavePayload,
  type EditorPart,
  type QuizFormInput,
  type QuizFormValues,
  type SavedQuiz,
} from '../../schemas/quiz'
import { announce } from '../../stores/announcerStore'
import { useConfirmDialog } from '../ConfirmDialog'
import { BasicsPart } from './BasicsPart'
import { ErrorSummary, summaryItems, type SummaryItem } from './ErrorSummary'
import { OutcomesPart } from './OutcomesPart'
import { fieldDomId } from './FieldError'
import { QuestionsPart } from './QuestionsPart'
import '../../styles/editor.css'

const PART_LABELS: Record<EditorPart, string> = {
  basics: 'Basics',
  outcomes: 'Outcomes',
  questions: 'Questions',
}

// The fields "Next" checks before leaving each part. For outcomes that is each name and
// description, but not whether an answer leads there yet (Publish checks that).
function partFields(part: EditorPart, values: QuizFormInput): FieldPath<QuizFormInput>[] {
  if (part === 'basics') return ['title', 'description', 'kind']
  if (part === 'outcomes') {
    return values.outcomes.flatMap((_, i) => [
      `outcomes.${i}.title` as const,
      `outcomes.${i}.description` as const,
    ])
  }
  return ['questions', 'hasSuggestedTime', 'suggestedMinutes']
}

type QuizEditorProps = {
  // The saved quiz when editing, or null for a new one.
  savedQuiz: SavedQuiz | null
  part: EditorPart
  // Start the form again with no draft (after the draft is discarded).
  onRestart: () => void
  // Editing only: fetch the latest saved version, then start again.
  onLoadLatest?: () => void
}

export function QuizEditor({ savedQuiz, part, onRestart, onLoadLatest }: QuizEditorProps) {
  const draftKey = quizDraftKey(savedQuiz?.id ?? null)
  // Read the draft once, for the form's starting values.
  const [draft] = useState(() => readQuizDraft(draftKey))
  // The version this work started from. Sent as expected_version when editing.
  const baseVersion = draft?.baseVersion ?? savedQuiz?.version ?? null

  // The one form for the whole quiz. Every part reads it through useFormContext.
  const form = useForm<QuizFormInput, unknown, QuizFormValues>({
    resolver: zodResolver(quizFormSchema),
    defaultValues: draft?.values ?? (savedQuiz ? fromSavedQuiz(savedQuiz) : emptyQuizValues()),
    shouldFocusError: false,
  })
  useQuizDraftWriter(form, draftKey, baseVersion, draft !== null)

  // Whether to show the error summary: set when Next or Publish finds problems.
  const [showSummary, setShowSummary] = useState(false)
  const save = useSaveQuiz()
  const { confirm, dialog } = useConfirmDialog()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const kind = useWatch({ control: form.control, name: 'kind' })

  const parts: EditorPart[] =
    kind === 'personality' ? ['basics', 'outcomes', 'questions'] : ['basics', 'questions']

  // The outcomes part only exists for personality quizzes, for a pasted URL too.
  if (part === 'outcomes' && kind === 'trivia') {
    return <Navigate to="." search={(prev) => ({ ...prev, part: 'basics' as const })} replace />
  }

  const partIndex = parts.indexOf(part)
  const saveError = save.error instanceof SaveQuizError ? save.error : null
  const isStale =
    (savedQuiz !== null && baseVersion !== null && baseVersion < savedQuiz.version) ||
    saveError?.code === 'stale_version'

  function showSummaryAndFocus() {
    setShowSummary(true)
    // After the summary has rendered.
    setTimeout(() => summaryRef.current?.focus(), 0)
  }

  async function goToPart(next: EditorPart) {
    await navigate({ to: '.', search: (prev) => ({ ...prev, part: next }) })
    headingRef.current?.focus()
    announce(`Part ${parts.indexOf(next) + 1} of ${parts.length}: ${PART_LABELS[next]}`)
  }

  async function handleNext() {
    const valid = await form.trigger(partFields(part, form.getValues()))
    if (!valid) {
      showSummaryAndFocus()
      return
    }
    await goToPart(parts[partIndex + 1])
  }

  async function handleSummarySelect(item: SummaryItem) {
    if (item.part !== part)
      await navigate({ to: '.', search: (prev) => ({ ...prev, part: item.part }) })
    // After the part with the field has rendered.
    setTimeout(() => document.getElementById(item.targetId)?.focus(), 0)
  }

  function publish(values: QuizFormValues, expectedVersion: number | null) {
    const edit = savedQuiz
      ? { id: savedQuiz.id, expectedVersion: expectedVersion ?? savedQuiz.version }
      : null
    save.mutate(toSavePayload(values, edit), {
      onSuccess: ({ id }) => {
        removeQuizDraft(draftKey)
        void queryClient.invalidateQueries({ queryKey: ['quizzes'] })
        void queryClient.invalidateQueries({ queryKey: ['quiz', id] })
        void queryClient.invalidateQueries({ queryKey: ['me'] })
        const message = savedQuiz ? 'Changes saved' : 'Quiz published'
        // Announce once the new page is showing, so its own page-change announcement
        // doesn't replace this one.
        void navigate({ to: '/search', search: { quiz: id } }).then(() =>
          setTimeout(() => announce(message), 0),
        )
      },
      onError: (error) => {
        const code = error instanceof SaveQuizError ? error.code : null
        if (code === 'stale_version') return // the stale-version notice shows instead
        if (code === 'duplicate_title') {
          form.setError('title', {
            type: 'server',
            message: `You already have a quiz called "${values.title}".`,
          })
          // The summary shows the link to the existing quiz; focus goes to the title field.
          setShowSummary(true)
          void handleSummarySelect({
            key: 'title',
            text: '',
            part: 'basics',
            targetId: fieldDomId('title'),
          })
          return
        }
        showSummaryAndFocus()
      },
    })
  }

  function handlePublish(event: FormEvent<HTMLFormElement>) {
    void form.handleSubmit((values) => publish(values, baseVersion), showSummaryAndFocus)(event)
  }

  async function handleSaveMine() {
    if (!savedQuiz) return
    const confirmed = await confirm({
      title: 'Save your version over it?',
      body: 'This replaces the changes saved elsewhere.',
      confirmLabel: 'Save mine over it',
    })
    if (!confirmed) return
    const latest = await queryClient.fetchQuery({ ...quizForEditQuery(savedQuiz.id), staleTime: 0 })
    const latestVersion = latest.status === 'ok' ? latest.quiz.version : baseVersion
    void form.handleSubmit((values) => publish(values, latestVersion), showSummaryAndFocus)()
  }

  async function handleLoadLatest() {
    const confirmed = await confirm({
      title: 'Load the latest version?',
      body: 'Your unsaved changes here will be lost.',
      confirmLabel: 'Load the latest version',
    })
    if (!confirmed) return
    removeQuizDraft(draftKey)
    onLoadLatest?.()
  }

  async function handleDiscard() {
    const confirmed = await confirm({
      title: 'Discard your draft?',
      body: savedQuiz
        ? 'Your unsaved changes will be lost, and the saved quiz will be loaded again.'
        : 'Everything you have entered will be cleared.',
      confirmLabel: 'Discard draft',
    })
    if (!confirmed) return
    removeQuizDraft(draftKey)
    announce('Draft discarded')
    onRestart()
  }

  // Server problems other than a stale version, shown in the error summary.
  let serverMessage = null
  if (saveError?.code === 'duplicate_title') {
    serverMessage = (
      <>
        You already have a quiz called &quot;{form.getValues('title').trim()}&quot;.{' '}
        <Link to="/search" search={{ quiz: saveError.detail }}>
          See your quiz
        </Link>
      </>
    )
  } else if (saveError?.code === 'rate_limited') {
    serverMessage = "You've made a lot of quizzes recently. Try again in a little while."
  } else if (save.isError && saveError?.code !== 'stale_version') {
    serverMessage = 'Something went wrong. Your draft is saved. Try again.'
  }

  // The duplicate-title message is already in the summary with its link, so skip the
  // title field's copy of it.
  const items = summaryItems(form.formState.errors).filter(
    (item) => !(saveError?.code === 'duplicate_title' && item.key === 'title'),
  )
  const hasDraft = draft !== null || form.formState.isDirty

  return (
    <FormProvider {...form}>
      <form className="form" noValidate onSubmit={handlePublish}>
        {isStale && (
          <div role="alert" className="border padding margin-bottom">
            <p>This quiz changed since you opened it (maybe in another tab).</p>
            <button type="button" className="btn" onClick={() => void handleLoadLatest()}>
              Load the latest version
            </button>{' '}
            <button type="button" className="btn" onClick={() => void handleSaveMine()}>
              Save mine over it
            </button>
          </div>
        )}

        {showSummary && (items.length > 0 || serverMessage) && (
          <ErrorSummary
            summaryRef={summaryRef}
            items={items}
            serverMessage={serverMessage}
            onSelect={(item) => void handleSummarySelect(item)}
          />
        )}

        <h2 ref={headingRef} tabIndex={-1}>
          Part {partIndex + 1} of {parts.length}: {PART_LABELS[part]}
        </h2>

        {part === 'basics' && <BasicsPart isEditing={savedQuiz !== null} />}
        {part === 'outcomes' && <OutcomesPart />}
        {part === 'questions' && <QuestionsPart />}

        <p>
          {partIndex > 0 && (
            <>
              <button
                type="button"
                className="btn"
                onClick={() => void goToPart(parts[partIndex - 1])}
              >
                Back
              </button>{' '}
            </>
          )}
          {partIndex < parts.length - 1 && (
            <>
              <button type="button" className="btn" onClick={() => void handleNext()}>
                Next
              </button>{' '}
            </>
          )}
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Publishing…' : savedQuiz ? 'Save changes' : 'Publish'}
          </button>{' '}
          {hasDraft && (
            <button type="button" className="btn" onClick={() => void handleDiscard()}>
              Discard draft
            </button>
          )}
        </p>
      </form>
      {dialog}
    </FormProvider>
  )
}
