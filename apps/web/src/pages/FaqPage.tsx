import { useEffect, useState, type ReactNode } from 'react'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import '../landing.css'

const FAQS: Array<{ q: string; a: ReactNode }> = [
  {
    q: 'What is GoalForge?',
    a: (
      <p>
        An AI-powered goal tracker with RPG-style progression. You describe a
        goal in plain language; GoalForge turns it into a SMART goal with
        milestones and a 7-day plan of small daily tasks. Completing them earns
        star points and evolves your star through six stages.
      </p>
    ),
  },
  {
    q: 'Is it free?',
    a: (
      <p>
        Yes — GoalForge is free during early access. We may introduce paid
        tiers later, but we will say so clearly before anything changes.
      </p>
    ),
  },
  {
    q: 'How does the AI work?',
    a: (
      <p>
        GoalForge uses Google&apos;s Gemini model to draft your goal plan and
        daily tasks. Every task it writes is editable — you can rewrite,
        regenerate, or reorder anything. The AI proposes; you decide.
      </p>
    ),
  },
  {
    q: 'What happens if I miss a few days?',
    a: (
      <p>
        Nothing bad — no lost points, no shame screens. If you have been away
        for a while, GoalForge switches to Easy Mode: it pauses your schedule
        and offers a couple of two-minute tasks to make restarting effortless.
      </p>
    ),
  },
  {
    q: 'Is my data private?',
    a: (
      <p>
        Sign-in is handled by Clerk, a dedicated authentication provider — we
        never see your password. We do not sell your data. You can export
        everything you have created (JSON or CSV) or permanently delete your
        account from Settings at any time.
      </p>
    ),
  },
  {
    q: 'Can I use it on my phone?',
    a: (
      <p>
        Yes — GoalForge is an installable web app (PWA). Open goalforge.me in
        your phone browser and choose &quot;Add to Home Screen&quot; for a
        native-feeling app on iOS and Android.
      </p>
    ),
  },
  {
    q: 'Can I contribute?',
    a: (
      <p>
        Absolutely — GoalForge is open source. Report bugs, suggest features,
        or open a pull request at{' '}
        <a href="https://github.com/Samat-ai/goalforge" target="_blank" rel="noreferrer">
          github.com/Samat-ai/goalforge
        </a>
        .
      </p>
    ),
  },
]

export default function FaqPage() {
  const [theme] = useState<'light' | 'dark'>(() => {
    const saved = window.localStorage.getItem('gf-landing-theme')
    return saved === 'dark' ? 'dark' : 'light'
  })
  useEffect(() => { document.title = 'FAQ · GoalForge' }, [])

  return (
    <div className="gfl-root gfl-static" data-theme={theme}>
      <div className="wrap">
        <SiteHeader />
        <main className="container static-main">
          <h1>Frequently asked questions</h1>
          <div className="faq-list">
            {FAQS.map((f) => (
              <details className="faq-item" key={f.q}>
                <summary>{f.q}</summary>
                <div className="faq-a">{f.a}</div>
              </details>
            ))}
          </div>
        </main>
        <SiteFooter />
      </div>
    </div>
  )
}
