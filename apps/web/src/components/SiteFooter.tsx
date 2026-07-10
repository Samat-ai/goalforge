import { Link } from 'react-router-dom'

// Footer shared by the marketing pages (Landing, About, FAQ). Section links
// use /#hash so they resolve from any route; About/FAQ are real routes.
export default function SiteFooter() {
  return (
    <footer>
      <div className="container">
        <div className="foot-in">
          <a className="logo" href="/#top">GoalForge</a>
          <div className="foot-links">
            <a href="/#chat">Chat</a>
            <a href="/#how">How it works</a>
            <a href="/#stages">Stages</a>
            <Link to="/about">About</Link>
            <Link to="/faq">FAQ</Link>
            <a href="/#cta">Get started</a>
          </div>
        </div>
        <div className="foot-copy">© 2026 GoalForge · Big goals, one small step at a time — with Solly.</div>
      </div>
    </footer>
  )
}
