import { Link } from '@tanstack/react-router'
import { CoverArt } from '../components/ui/CoverArt'
import '../styles/home.css'

// The description was chosen by the project owner (2026-11-12).
export function HomePage() {
  return (
    <main className="units-container">
      <div className="home-hero">
        <div className="home-hero-text">
          <h1 tabIndex={-1}>Quiz Maker</h1>
          <p className="tagline">Take a quiz, see your result, and make your own.</p>
          <p>
            <Link to="/search" className="btn btn-primary">
              Find a quiz
            </Link>
          </p>
        </div>
        <CoverArt />
      </div>
    </main>
  )
}
