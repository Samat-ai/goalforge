import { useUser } from '@clerk/react'
import AppHeader from '../components/AppHeader'
import { T } from '../lib/theme'
import { useProfileQuery } from '../hooks'
import { useSubscription, useCreateCheckout, useCreatePortal } from '../hooks/useSubscription'

const PRO_FEATURES = [
  'Unlimited active goals (Free plan: 3)',
  'AI Rescue Mode on all goals',
  'Advanced analytics & weekly star logs',
  'Priority AI coaching sessions',
  'Exclusive Pro relics & themes',
  'Early access to new features',
]

export default function Billing() {
  const { user } = useUser()
  const userId = user?.id ?? ''

  const { data: profile } = useProfileQuery(userId)
  const pts = profile?.star_points ?? 0

  const { data: subscription, isLoading } = useSubscription(userId || undefined)
  const { mutate: startCheckout, isPending: isCheckingOut } = useCreateCheckout(userId || undefined)
  const { mutate: openPortal, isPending: isOpeningPortal } = useCreatePortal(userId || undefined)

  const isPro = subscription?.plan === 'pro' && subscription?.status === 'active'
  const isPastDue = subscription?.status === 'past_due'

  function formatPeriodEnd(iso: string | null | undefined): string {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text }}>
      <AppHeader pts={pts} />

      <main id="main-content" style={{ maxWidth: 680, margin: '0 auto', padding: '40px 20px' }}>
        {/* Page heading */}
        <h1 style={{ fontFamily: T.serif, fontSize: 28, marginBottom: 8, color: T.text }}>
          Billing
        </h1>
        <p style={{ fontFamily: T.mono, fontSize: 13, color: T.muted, marginBottom: 40 }}>
          Manage your GoalForge subscription.
        </p>

        {isLoading ? (
          <p style={{ fontFamily: T.mono, fontSize: 13, color: T.muted }}>Loading…</p>
        ) : (
          <>
            {/* Current plan card */}
            <div style={{
              border: `1px solid ${isPro ? T.orange + '60' : T.border}`,
              borderRadius: 12,
              padding: '24px 28px',
              marginBottom: 32,
              background: isPro ? T.orange + '08' : 'transparent',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{
                  fontFamily: T.mono, fontSize: 11, letterSpacing: '0.08em',
                  background: isPro ? T.orange + '20' : T.muted + '20',
                  color: isPro ? T.orange : T.muted,
                  border: `1px solid ${isPro ? T.orange + '40' : T.border}`,
                  padding: '3px 10px', borderRadius: 99,
                }}>
                  {isPro ? 'PRO' : 'FREE'}
                </span>
                {isPastDue && (
                  <span style={{
                    fontFamily: T.mono, fontSize: 11,
                    background: '#ef444420', color: '#ef4444',
                    border: '1px solid #ef444440',
                    padding: '3px 10px', borderRadius: 99,
                  }}>
                    PAST DUE
                  </span>
                )}
              </div>

              <h2 style={{ fontFamily: T.serif, fontSize: 20, marginBottom: 8 }}>
                {isPro ? 'GoalForge Pro' : 'GoalForge Free'}
              </h2>

              {isPro && subscription?.current_period_end && (
                <p style={{ fontFamily: T.mono, fontSize: 12, color: T.muted, marginBottom: 0 }}>
                  {subscription.status === 'canceled'
                    ? `Access until ${formatPeriodEnd(subscription.current_period_end)}`
                    : `Renews ${formatPeriodEnd(subscription.current_period_end)}`}
                </p>
              )}

              {isPastDue && (
                <p style={{ fontFamily: T.mono, fontSize: 12, color: '#ef4444', marginTop: 8 }}>
                  Payment failed. Please update your payment method to keep Pro access.
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 40, flexWrap: 'wrap' }}>
              {!isPro && (
                <button
                  onClick={() => startCheckout()}
                  disabled={isCheckingOut}
                  style={{
                    fontFamily: T.mono, fontSize: 13, cursor: isCheckingOut ? 'not-allowed' : 'pointer',
                    background: T.orange, color: '#000',
                    border: 'none', borderRadius: 8, padding: '10px 24px',
                    opacity: isCheckingOut ? 0.7 : 1,
                    fontWeight: 600,
                  }}
                >
                  {isCheckingOut ? 'Redirecting…' : 'Upgrade to Pro — $9/mo'}
                </button>
              )}

              {(isPro || isPastDue) && (
                <button
                  onClick={() => openPortal()}
                  disabled={isOpeningPortal}
                  style={{
                    fontFamily: T.mono, fontSize: 13, cursor: isOpeningPortal ? 'not-allowed' : 'pointer',
                    background: 'transparent', color: T.text,
                    border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 24px',
                    opacity: isOpeningPortal ? 0.7 : 1,
                  }}
                >
                  {isOpeningPortal ? 'Opening portal…' : 'Manage Subscription'}
                </button>
              )}
            </div>

            {/* Pro features list */}
            {!isPro && (
              <div style={{
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                padding: '24px 28px',
              }}>
                <h3 style={{ fontFamily: T.serif, fontSize: 17, marginBottom: 16, color: T.text }}>
                  What's included in Pro
                </h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {PRO_FEATURES.map((feature) => (
                    <li
                      key={feature}
                      style={{
                        fontFamily: T.mono, fontSize: 13, color: T.muted,
                        padding: '7px 0',
                        borderBottom: `1px solid ${T.border}`,
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}
                    >
                      <span style={{ color: T.orange }}>✦</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
