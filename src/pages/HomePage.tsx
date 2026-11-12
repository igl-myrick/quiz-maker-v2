import { Link } from '@tanstack/react-router'
import { QuizIllustration } from '../components/QuizIllustration'

// The description was chosen by the project owner (2026-11-12).
export function HomePage() {
  return (
    <main className="units-container">
      <h1 tabIndex={-1}>Quiz Maker</h1>
      <p>Take a quiz, see your result, and make your own.</p>
      <QuizIllustration />
      <p>
        <Link to="/search" className="btn btn-primary">
          Find a quiz
        </Link>
      </p>
    </main>
  )
}
