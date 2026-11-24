import { useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { MyQuizzesSection } from '../components/dashboard/MyQuizzesSection'
import { MyResultsSection } from '../components/dashboard/MyResultsSection'
import { SummaryTiles } from '../components/dashboard/SummaryTiles'
import { useAuthStatus, useSession } from '../stores/authStore'
import { clearNotice, useNoticeStore } from '../stores/noticeStore'
import '../styles/dashboard.css'

// Members see their saved results and their quizzes. Anonymous visitors are pointed at the
// header's Log in button, which stays mounted, so after logging in focus returns to it and
// the dashboard appears here. Never shows the member's email or any account identifier.
export function DashboardPage() {
  const status = useAuthStatus()
  const session = useSession()
  const router = useRouter()
  // "Quiz created" or "Changes saved" from the editor (change 12). The editor announces it,
  // so this is plain text, not a live region. It goes when the person leaves the page:
  // clearing on the next navigation, rather than on unmount, keeps it through StrictMode's
  // trial unmount in development.
  const notice = useNoticeStore((state) => state.notice)
  useEffect(() => router.subscribe('onBeforeNavigate', clearNotice), [router])

  return (
    <main className="units-container">
      <h1 tabIndex={-1}>Your dashboard</h1>
      {notice && (
        <p className="dashboard-notice">
          {notice} <span aria-hidden="true">✓</span>
        </p>
      )}
      {status === 'ready' &&
        (session ? (
          <>
            <SummaryTiles />
            <MyResultsSection />
            <MyQuizzesSection />
          </>
        ) : (
          <p>
            Log in with the <strong>Log in</strong> button at the top of the page to see your
            dashboard.
          </p>
        ))}
    </main>
  )
}
