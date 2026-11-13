import { useRef, useState } from 'react'
import { z } from 'zod'
import { LoginButton } from '../components/LoginButton'
import { QuizEditor } from '../components/quiz-editor/QuizEditor'
import { useQuizForEdit } from '../hooks/useQuizForEdit'
import type { EditorPart } from '../schemas/quiz'
import { useAuthStatus, useSession } from '../stores/authStore'

type QuizEditorPageProps = {
  // null when creating a new quiz.
  quizId: string | null
  part: EditorPart
}

export function QuizEditorPage({ quizId, part }: QuizEditorPageProps) {
  const status = useAuthStatus()
  const session = useSession()
  const headingRef = useRef<HTMLHeadingElement>(null)

  let content = null
  if (status === 'ready' && !session) {
    content = (
      <>
        <p>Log in to create a quiz.</p>
        {/* This button disappears once logged in, so focus moves to the page heading. */}
        <LoginButton onLoggedIn={() => headingRef.current?.focus()} />
      </>
    )
  } else if (session) {
    content = quizId ? <EditQuiz quizId={quizId} part={part} /> : <NewQuiz part={part} />
  }

  return (
    <main className="units-container">
      <h1 ref={headingRef} tabIndex={-1}>
        {quizId ? 'Edit quiz' : 'Create a quiz'}
      </h1>
      {content}
    </main>
  )
}

function NewQuiz({ part }: { part: EditorPart }) {
  // Changing the key starts the form again from scratch (after discarding the draft).
  const [formKey, setFormKey] = useState(0)
  return (
    <QuizEditor
      key={formKey}
      savedQuiz={null}
      part={part}
      onRestart={() => setFormKey((k) => k + 1)}
    />
  )
}

const isUuid = (value: string) => z.uuid().safeParse(value).success

function EditQuiz({ quizId, part }: { quizId: string; part: EditorPart }) {
  const validId = isUuid(quizId)
  const query = useQuizForEdit(quizId, validId)
  // Changing the key starts the form again (after discarding or loading the latest version).
  const [formKey, setFormKey] = useState(0)

  if (!validId || query.data?.status === 'not_found') return <p>This quiz no longer exists.</p>
  if (query.data?.status === 'forbidden') return <p>You can only edit your own quizzes.</p>
  if (query.isError) {
    return (
      <>
        <p>Couldn&apos;t load this quiz.</p>
        <button type="button" className="btn" onClick={() => void query.refetch()}>
          Try again
        </button>
      </>
    )
  }
  // The form only mounts once the quiz has loaded, because its starting values are read once.
  if (query.data?.status !== 'ok') return <p>Loading quiz…</p>

  async function loadLatest() {
    await query.refetch()
    setFormKey((k) => k + 1)
  }

  return (
    <QuizEditor
      key={formKey}
      savedQuiz={query.data.quiz}
      part={part}
      onRestart={() => setFormKey((k) => k + 1)}
      onLoadLatest={() => void loadLatest()}
    />
  )
}
