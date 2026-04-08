import * as Sentry from "@sentry/react"

export function initSentry(dsn: string | undefined, environment: string): void {
  if (!dsn) return
  Sentry.init({
    dsn,
    environment,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
    beforeSend(event) {
      if (import.meta.env.DEV) return null
      return event
    },
  })
}

export { Sentry }
