import { Link } from 'react-router-dom'
import { Show } from '@clerk/react'

// Slim top bar for the static marketing pages (About, FAQ). The landing page
// keeps its own full hero nav. `scrolled` is applied statically so the fixed
// bar always has its solid backdrop on these short pages.
export default function SiteHeader() {
  return (
    <nav className="top scrolled">
      <div className="nav-in">
        <Link className="logo" to="/">GoalForge</Link>
        <div className="nav-right">
          <Show when="signed-out">
            <Link className="btn-primary" to="/sign-up">Get started</Link>
          </Show>
          <Show when="signed-in">
            <Link className="btn-primary" to="/dashboard">Open Dashboard</Link>
          </Show>
        </div>
      </div>
    </nav>
  )
}
