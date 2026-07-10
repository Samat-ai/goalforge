import { useEffect, useState } from 'react'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import '../landing.css'

export default function AboutPage() {
  const [theme] = useState<'light' | 'dark'>(() => {
    const saved = window.localStorage.getItem('gf-landing-theme')
    return saved === 'dark' ? 'dark' : 'light'
  })
  useEffect(() => { document.title = 'About · GoalForge' }, [])

  return (
    <div className="gfl-root gfl-static" data-theme={theme}>
      <div className="wrap">
        <SiteHeader />
        <main className="container static-main">
          <section className="about-section">
            <h1>Big goals die from friction, not lack of ambition.</h1>
            <p>
              You know what you want — run the half-marathon, learn the language,
              launch the thing. What kills it is the gap between the dream and
              what to do <em>today</em>. GoalForge exists to close that gap.
            </p>
          </section>

          <section className="about-section">
            <h2>What GoalForge does</h2>
            <p>
              Describe your goal in plain words. Our AI forges it into a SMART
              goal with milestones and a 7-day sprint of small daily tasks.
              Completing tasks earns star points ⭐ — and your star evolves
              through six brightness stages, from Speck to Celestial.
            </p>
            <p>
              Miss a few days? No guilt mechanics. GoalForge quietly shrinks the
              next step until it feels easy to start again.
            </p>
          </section>

          <section className="about-section">
            <h2>Meet Solly</h2>
            <img className="about-solly" src="/solly-landing/Solly.png" alt="Solly, the GoalForge sun mascot" />
            <p>
              Solly is your goal-getting buddy — equal parts coach and
              cheerleader. Solly asks the right questions, celebrates every win,
              and never makes you feel behind.
            </p>
          </section>

          <section className="about-section">
            <h2>Built by a human — open to more</h2>
            <p>
              GoalForge is built by Samat Kerimkulov, a solo developer. The
              project is open source: star the repo, file an issue, or send a
              pull request.
            </p>
            <a
              className="btn-ghost"
              href="https://github.com/Samat-ai/goalforge"
              target="_blank"
              rel="noreferrer"
            >
              GoalForge on GitHub →
            </a>
          </section>
        </main>
        <SiteFooter />
      </div>
    </div>
  )
}
