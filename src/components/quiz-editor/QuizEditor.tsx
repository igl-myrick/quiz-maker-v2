import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate } from '@tanstack/react-router'
import { useRef, useState, type FormEvent } from 'react'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { usePagedForm } from '../../hooks/usePagedForm'
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
  quizStepSchema,
  toSavePayload,
  type EditorPart,
  type QuizFormInput,
  type QuizFormValues,
  type SavedQuiz,
  type ValidationStage,
} from '../../schemas/quiz'
import { announce } from '../../stores/announcerStore'
import { useConfirmDialog } from '../ConfirmDialog'
import { ErrorSummary } from '../ui/ErrorSummary'
import { StepPills } from '../ui/StepPills'
import { BasicsPart } from './BasicsPart'
import { fieldDomId } from './FieldError'
import { OutcomesPart } from './OutcomesPart'
import { QuestionsPart } from './QuestionsPart'
import { partOf, summaryItems } from './summaryItems'
import '../../styles/editor.css'

const PART_LABELS: Record<EditorPart, string> = {
  basics: 'Basics',
  outcomes: 'Outcomes',
  questions: 'Questions',
}

// Next validates the whole form with the step rules; Publish with every rule.
const stepResolver = zodResolver(quizStepSchema)
const finishResolver = zodResolver(quizFormSchema)

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

  // Which rules the resolver applies. 'step' only while Next checks the form.
  const stage = useRef<ValidationStage>('finish')

  // The one form for the whole quiz. Every part reads it through useFormContext.
  const form = useForm<QuizFormInput, unknown, QuizFormValues>({
    resolver: (values, context, options) =>
      (stage.current === 'step' ? stepResolver : finishResolver)(values, context, options),
    defaultValues: draft?.values ?? (savedQuiz ? fromSavedQuiz(savedQuiz) : emptyQuizValues()),
    shouldFocusError: false,
  })
  useQuizDraftWriter(form, draftKey, baseVersion, draft !== null)

  const save = useSaveQuiz()
  const { confirm, dialog } = useConfirmDialog()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const kind = useWatch({ control: form.control, name: 'kind' })

  const parts: EditorPart[] =
    kind === 'personality' ? ['basics', 'outcomes', 'questions'] : ['basics', 'questions']
  const { headingRef, summaryRef, ...paged } = usePagedForm({
    steps: parts,
    current: part,
    goToStep: (next) => navigate({ to: '.', search: (prev) => ({ ...prev, part: next }) }),
    describeStep: (p, index, total) => `Part ${index + 1} of ${total}: ${PART_LABELS[p]}`,
  })

  // The outcomes part only exists for personality quizzes, for a pasted URL too.
  if (part === 'outcomes' && kind === 'trivia') {
    return <Navigate to="." search={(prev) => ({ ...prev, part: 'basics' as const })} replace />
  }

  const partIndex = parts.indexOf(part)
  const saveError = save.error instanceof SaveQuizError ? save.error : null
  const isStale =
    (savedQuiz !== null && baseVersion !== null && baseVersion < savedQuiz.version) ||
    saveError?.code === 'stale_version'

  // Next's check: validate the whole form with the step rules, and pass if nothing is
  // wrong on this part. Problems on later parts wait until the person gets there.
  async function partIsValid() {
    const result = quizStepSchema.safeParse(form.getValues())
    const valid =
      result.success || !result.error.issues.some((issue) => partOf(issue.path) === part)
    if (valid) {
      // This part is clean, so this only clears later parts' errors: the next part
      // shouldn't open already showing errors for fields the person hasn't reached.
      form.clearErrors()
      return true
    }
    // Show the inline errors, with the step rules.
    stage.current = 'step'
    try {
      await form.trigger()
    } finally {
      stage.current = 'finish'
    }
    return false
  }

  function showFinishSummary() {
    paged.showSummary('finish')
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
          paged.showSummary('finish')
          void paged.selectItem({
            key: 'title',
            text: '',
            step: 'basics',
            targetId: fieldDomId('title'),
          })
          return
        }
        showFinishSummary()
      },
    })
  }

  function handlePublish(event: FormEvent<HTMLFormElement>) {
    void form.handleSubmit((values) => publish(values, baseVersion), showFinishSummary)(event)
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
    void form.handleSubmit((values) => publish(values, latestVersion), showFinishSummary)()
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
  // title field's copy of it. After Next, only this part's problems are listed.
  const items = summaryItems(form.formState.errors)
    .filter((item) => !(saveError?.code === 'duplicate_title' && item.key === 'title'))
    .filter((item) => paged.lastCheck !== 'step' || item.step === part)
  const hasDraft = draft !== null || form.formState.isDirty

  return (
    <FormProvider {...form}>
      {/* A personality quiz turns the editor's buttons, controls, focus and confirm popups
          purple, from the moment Personality is picked. */}
      <div className="editor-frame" data-kind={kind === 'personality' ? 'personality' : undefined}>
        <form className="form" noValidate onSubmit={handlePublish}>
          {isStale && (
            <div role="alert" className="border padding margin-bottom">
              <p>This quiz changed since you opened it (maybe in another tab).</p>
              <div className="btn-group">
                <button type="button" className="btn" onClick={() => void handleLoadLatest()}>
                  Load the latest version
                </button>
                <button type="button" className="btn" onClick={() => void handleSaveMine()}>
                  Save mine over it
                </button>
              </div>
            </div>
          )}

          {paged.lastCheck !== null && (items.length > 0 || serverMessage) && (
            <ErrorSummary
              summaryRef={summaryRef}
              heading="Fix these before publishing"
              headingLevel={3}
              items={items}
              onSelect={(item) => void paged.selectItem(item)}
            >
              {serverMessage && <p>{serverMessage}</p>}
            </ErrorSummary>
          )}

          {/* Decorative; the heading below is what screen readers use. */}
          <StepPills steps={parts.map((p) => PART_LABELS[p])} current={partIndex + 1} />
          <h2 ref={headingRef} tabIndex={-1}>
            {paged.stepHeading}
          </h2>

          {part === 'basics' && <BasicsPart isEditing={savedQuiz !== null} />}
          {part === 'outcomes' && <OutcomesPart />}
          {part === 'questions' && <QuestionsPart />}

          {/* Back and Discard draft on the left; Next and Publish on the right. */}
          <div className="editor-nav">
            <div className="editor-nav-start">
              {partIndex > 0 && (
                <button type="button" className="btn" onClick={() => void paged.back()}>
                  Back
                </button>
              )}
              {hasDraft && (
                <button type="button" className="btn" onClick={() => void handleDiscard()}>
                  Discard draft
                </button>
              )}
            </div>
            <div className="editor-nav-end">
              {partIndex < parts.length - 1 && (
                <button type="button" className="btn" onClick={() => void paged.next(partIsValid)}>
                  Next
                </button>
              )}
              <button type="submit" className="btn btn-primary" disabled={save.isPending}>
                {save.isPending ? 'Publishing…' : savedQuiz ? 'Save changes' : 'Publish'}
              </button>
            </div>
          </div>
        </form>
        {dialog}
      </div>
    </FormProvider>
  )
}
