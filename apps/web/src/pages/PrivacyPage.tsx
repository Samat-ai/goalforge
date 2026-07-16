import { useEffect, useState } from 'react'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import '../landing.css'

export default function PrivacyPage() {
  const [theme] = useState<'light' | 'dark'>(() => {
    const saved = window.localStorage.getItem('gf-landing-theme')
    return saved === 'dark' ? 'dark' : 'light'
  })
  useEffect(() => { document.title = 'Privacy Policy · GoalForge' }, [])

  return (
    <div className="gfl-root gfl-static" data-theme={theme}>
      <div className="wrap">
        <SiteHeader />
        <main className="container static-main">
          <section className="about-section">
            <h1>Privacy Policy</h1>
            <p className="legal-updated">Last updated: July 16, 2026</p>
            <p>
              GoalForge (goalforge.me) is a goal-tracking app built by Samat
              Kerimkulov, a solo developer. This page explains what data
              GoalForge collects, why, and what control you have over it. The
              short version: we collect only what the app needs to work, we do
              not run ads or tracking, and we never sell your data.
            </p>
          </section>

          <section className="about-section">
            <h2>What we collect</h2>
            <ul>
              <li>
                <strong>Account information.</strong> Sign-in is handled by{' '}
                <a href="https://clerk.com" target="_blank" rel="noreferrer">Clerk</a>,
                a dedicated authentication provider. Through Clerk we receive
                your email address, name, and a unique account ID. We never see
                or store your password.
              </li>
              <li>
                <strong>Content you create.</strong> Your goals, milestones,
                daily tasks, settings, and your conversations with Solly (the
                AI coach) are stored so the app can show them back to you.
              </li>
              <li>
                <strong>Technical basics.</strong> Standard server logs
                (request paths, timestamps, IP addresses) kept for security and
                debugging. When something crashes, an error report (the error
                and what request triggered it) goes to Sentry so we can fix it.
                We also count visits with Simple Analytics, a privacy-first
                tool that uses no cookies and collects no personal data — we
                see page counts, never who you are. Cloudflare, which serves
                the site, additionally measures page-load performance through
                its cookieless Web Analytics — timing metrics only, no
                cookies, no fingerprinting, no personal data. No advertising
                trackers of any kind.
              </li>
            </ul>
          </section>

          <section className="about-section">
            <h2>How the AI works with your data</h2>
            <p>
              When you describe a goal or chat with Solly, that text is sent to
              Google&apos;s Gemini API to generate your plan and coach replies.
              It is used only to produce the response you asked for — we do not
              use your content to train AI models.
            </p>
          </section>

          <section className="about-section">
            <h2>Service providers</h2>
            <p>
              GoalForge relies on a small set of providers to run, each
              receiving only what their job requires:
            </p>
            <ul>
              <li><strong>Clerk</strong> — authentication and account management.</li>
              <li><strong>Google (Gemini API)</strong> — AI plan and chat generation.</li>
              <li><strong>Resend</strong> — sending email digests and reminders.</li>
              <li><strong>Heroku</strong> — application hosting and database infrastructure.</li>
              <li><strong>Cloudflare</strong> — serving the site (CDN/DNS), backup storage, and cookieless performance analytics.</li>
              <li><strong>Sentry</strong> — error monitoring, so crashes get noticed and fixed.</li>
              <li><strong>Simple Analytics</strong> — cookieless visit counting; no personal data.</li>
            </ul>
          </section>

          <section className="about-section">
            <h2>Cookies and local storage</h2>
            <p>
              GoalForge uses only strictly necessary cookies — the session
              cookies Clerk sets to keep you signed in. Preferences such as
              your theme and onboarding state live in your browser&apos;s local
              storage and never leave your device. There are no advertising or
              analytics cookies, which is why you will not see a cookie banner
              here.
            </p>
          </section>

          <section className="about-section">
            <h2>Emails and notifications</h2>
            <p>
              GoalForge can send you progress digests, reminders, and optional
              push notifications. All of them can be turned off in Settings,
              and push notifications are only ever enabled if you explicitly
              allow them in your browser.
            </p>
          </section>

          <section className="about-section">
            <h2>Your rights and controls</h2>
            <p>
              You stay in control of your data, directly from the app:
            </p>
            <ul>
              <li>
                <strong>Export</strong> — download everything you have created
                as JSON or CSV from Settings, anytime.
              </li>
              <li>
                <strong>Delete</strong> — permanently delete your account data
                from Settings. This removes your goals, tasks, chat history,
                and profile from our database.
              </li>
              <li>
                <strong>Ask</strong> — for anything else (access, correction,
                or questions about this policy), email{' '}
                <a href="mailto:goalforge65@gmail.com">goalforge65@gmail.com</a>{' '}
                and we will respond as quickly as a one-person team can.
              </li>
            </ul>
            <p>
              If you are in the EU/EEA or UK, these controls cover your rights
              of access, portability, and erasure under the GDPR; the legal
              basis for processing your data is performance of the service you
              signed up for.
            </p>
          </section>

          <section className="about-section">
            <h2>Data retention</h2>
            <p>
              Your data is kept for as long as your account exists. When you
              delete your account data, it is removed from the live database
              immediately; routine database backups age out within 30 days.
            </p>
          </section>

          <section className="about-section">
            <h2>Changes to this policy</h2>
            <p>
              If this policy changes in a meaningful way, we will update the
              date at the top and, for significant changes, let you know in the
              app or by email.
            </p>
          </section>
        </main>
        <SiteFooter />
      </div>
    </div>
  )
}
