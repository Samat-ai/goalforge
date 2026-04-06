import { useEffect } from 'react'
import { useUser } from '@clerk/react'
import AppHeader from '../components/AppHeader'
import StarShop from '../components/StarShop'
import { T } from '../lib/theme'
import { useProfileQuery, useShopRewardsQuery, useShopRewardMutations, useStarLogQuery } from '../hooks'

const isE2EMode = import.meta.env.VITE_E2E_MODE === 'true'
const e2eUserId = import.meta.env.VITE_E2E_USER_ID ?? 'user_e2e'

export default function Stars() {
  const { user } = useUser()
  const userId = user?.id ?? (isE2EMode ? e2eUserId : undefined)

  const { pts } = useProfileQuery(userId)
  const { rewards: shopRewards } = useShopRewardsQuery(userId)
  const shopMutations = useShopRewardMutations(userId ?? '')
  const { data: starLog } = useStarLogQuery(userId, 7)

  useEffect(() => { document.title = 'Stars — GoalForge' }, [])

  return (
    <div className="mesh-bg" style={{ minHeight: '100dvh', background: T.bg, color: T.text, fontFamily: T.mono }}>
      <AppHeader pts={pts} />
      <main id="main-content" style={{ maxWidth: 1100, margin: '0 auto' }} className="px-4 py-5 sm:px-8 sm:py-7">
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: T.serif, fontWeight: 400, color: T.text, marginBottom: 3 }} className="text-[26px] sm:text-[32px] lg:text-[38px]">
            Stars
          </h1>
          <p style={{ fontSize: 12, color: T.muted }}>
            Your star economy — stories, rewards, and progress
          </p>
        </div>

        {/* ── Star Log ── */}
        {starLog && (
          <div style={{
            background: T.card,
            border: `1px solid ${starLog.is_fallback ? T.border : T.amber}40`,
            borderRadius: 12,
            padding: '16px 18px',
            marginBottom: 20,
          }}>
            <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, letterSpacing: '0.08em', marginBottom: 6 }}>
              STAR LOG
            </div>
            <div style={{ fontFamily: T.serif, fontSize: 18, color: starLog.is_fallback ? T.muted : T.amber, marginBottom: 6, lineHeight: 1.4 }}>
              {starLog.chapter_title}
            </div>
            <div style={{ fontSize: 12, color: T.text, lineHeight: 1.7, marginBottom: 10 }}>
              {starLog.chapter_body}
            </div>
            {starLog.highlights.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {starLog.highlights.map((h, i) => (
                  <span key={i} style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 20,
                    fontFamily: T.mono, letterSpacing: '0.04em',
                    border: `1px solid ${T.amber}40`, background: `${T.amber}10`, color: T.amber,
                  }}>
                    {h}
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: T.textDim, fontFamily: T.mono }}>
              <span>Tasks: <span style={{ color: T.emerald }}>{starLog.completed_tasks}</span></span>
              <span>Days: <span style={{ color: T.emerald }}>{starLog.completed_days}</span></span>
            </div>
          </div>
        )}

        <StarShop
          pts={pts}
          rewards={shopRewards}
          onAdd={shopMutations.addReward}
          onRedeem={shopMutations.redeemReward}
          isCreating={shopMutations.isCreating}
          isRedeeming={shopMutations.isRedeeming}
        />
      </main>
    </div>
  )
}
