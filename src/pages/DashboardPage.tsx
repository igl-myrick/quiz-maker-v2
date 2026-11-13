import { MyQuizzesSection } from '../components/dashboard/MyQuizzesSection'
import { MyResultsSection } from '../components/dashboard/MyResultsSection'
import { useAuthStatus, useSession } from '../stores/authStore'

// Members see their saved results and their quizzes. Anonymous visitors are pointed at the
// header's Log in button, which stays mounted, so after logging in focus returns to it and
// the dashboard appears here. Never shows the member's email or any account identifier.
export function DashboardPage() {
  const status = useAuthStatus()
  const session = useSession()

  return (
    <main className="units-container">
      <h1 tabIndex={-1}>Your dashboard</h1>
      {status === 'ready' &&
        (session ? (
          <>
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
