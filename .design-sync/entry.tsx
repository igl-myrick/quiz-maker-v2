// Entry for the Claude Design sync (/design-sync). It exports only the presentational
// components that render without Supabase, plus the app's real stylesheets, so the
// design system bundle never pulls in the Supabase client or env variables.
import 'ply-css/dist/css/ply.min.css'
import '../src/styles/app.css'
import '../src/styles/search.css'
import '../src/styles/settings.css'
import '@fontsource/lexend/400.css'
import '@fontsource/lexend/700.css'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { createContext, useContext, useState, type ReactNode } from 'react'
import { Announcer } from '../src/components/Announcer'

export { Announcer }
export { ConfirmDialog } from '../src/components/ConfirmDialog'
export { QuizCard } from '../src/components/QuizCard'
export { QuizIllustration } from '../src/components/QuizIllustration'
export { SearchForm } from '../src/components/SearchForm'
export { FieldError } from '../src/components/quiz-editor/FieldError'
export { CopyLinkButton } from '../src/components/result/CopyLinkButton'
export { PersonalityResult } from '../src/components/result/PersonalityResult'
export { ResultNotices } from '../src/components/result/ResultNotices'
export { TriviaResult } from '../src/components/result/TriviaResult'
export { ResultRow } from '../src/components/dashboard/ResultRow'
export { Countdown } from '../src/components/take/Countdown'
export { ErrorSummary } from '../src/components/take/ErrorSummary'
export { PageNav } from '../src/components/take/PageNav'
export { QuestionFieldset } from '../src/components/take/QuestionFieldset'

const ContentContext = createContext<ReactNode>(null)

function Content() {
  return <>{useContext(ContentContext)}</>
}

function makeRouter() {
  const rootRoute = createRootRoute({ component: Content })
  const routes = ['/', '/search', '/dashboard', '/results/$resultId'].map((path) =>
    createRoute({ getParentRoute: () => rootRoute, path }),
  )
  return createRouter({
    routeTree: rootRoute.addChildren(routes),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
}

// Wrap designs in this. It gives router-based components (QuizCard, SearchForm,
// ResultRow, ResultNotices) an in-memory router, and renders the app's one live region
// so announce() messages reach screen readers.
export function QuizMakerProvider({ children }: { children?: ReactNode }) {
  const [router] = useState(makeRouter)
  return (
    <ContentContext.Provider value={children}>
      <RouterProvider router={router} />
      <Announcer />
    </ContentContext.Provider>
  )
}
