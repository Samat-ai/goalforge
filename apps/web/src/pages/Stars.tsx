import { useEffect } from 'react'
import { useUser } from '@clerk/react'
import AppHeader from '../components/AppHeader'
import StarShop from '../components/StarShop'
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
    <div className="min-h-dvh mesh-bg" style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
      <AppHeader pts={pts} />
      <main id="main-content" className="gf-main">
        <div className="gf-page">
          <div>
            <div className="gf-eyebrow">Your journey, in chapters</div>
          </div>

          {/* ── Star Log ── */}
          {starLog && (
            <div className="gf-card gf-starlog">
              <div className="gf-starlog-rail" />
              <div className="gf-starlog-aside">
                <div className="gf-starlog-eyebrow">✦ This week&apos;s chapter</div>
                <h2 className="gf-starlog-title">{starLog.chapter_title}</h2>
                {starLog.highlights.length > 0 && (
                  <div className="gf-starlog-tags">
                    {starLog.highlights.map((h, i) => (
                      <span key={i} className="gf-starlog-tag">{h}</span>
                    ))}
                  </div>
                )}
                <div className="gf-starlog-foot">
                  <span>✓ {starLog.completed_tasks} tasks</span>
                  <span>◈ {starLog.completed_days} active days</span>
                </div>
              </div>
              <div className="gf-starlog-main">
                <p className="gf-starlog-body">{starLog.chapter_body}</p>
              </div>
            </div>
          )}

          {/* ── Star Shop ── */}
          <StarShop
            pts={pts}
            rewards={shopRewards}
            onAdd={shopMutations.addReward}
            onRedeem={shopMutations.redeemReward}
            isCreating={shopMutations.isCreating}
            isRedeeming={shopMutations.isRedeeming}
          />
        </div>
      </main>
    </div>
  )
}
