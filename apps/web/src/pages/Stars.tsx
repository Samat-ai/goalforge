import { useEffect } from 'react'
import { useUser } from '@clerk/react'
import StarShop from '../components/StarShop'
import Icon from '../components/ui/Icon'
import { useProfileQuery, useShopRewardsQuery, useShopRewardMutations, useStarLogQuery } from '../hooks'

const isE2EMode = import.meta.env.VITE_E2E_MODE === 'true'
const e2eUserId = import.meta.env.VITE_E2E_USER_ID ?? 'user_e2e'

export default function Stars() {
  const { user } = useUser()
  const userId = user?.id ?? (isE2EMode ? e2eUserId : undefined)

  const { pts } = useProfileQuery(userId)
  const { rewards: shopRewards } = useShopRewardsQuery(userId)
  const shopMutations = useShopRewardMutations(userId ?? '')
  const { data: starLog, isLoading: starLogLoading } = useStarLogQuery(userId, 7)

  useEffect(() => { document.title = 'Logs — GoalForge' }, [])

  return (
    <div className="min-h-dvh mesh-bg">
      <main id="main-content" className="gf-main">
        <div className="gf-page">
          <div>
            <div className="gf-eyebrow">Your journey, in chapters</div>
          </div>

          {/* ── Star Log ── */}
          {starLogLoading && (
            <div className="gf-card gf-starlog">
              <div className="gf-starlog-rail" />
              <div className="gf-starlog-aside">
                <div className="gf-starlog-eyebrow"><Icon name="spark" size={12} /> This week&apos;s chapter</div>
                <div className="gf-starlog-title" style={{ opacity: 0.35 }}>Loading your chapter…</div>
              </div>
              <div className="gf-starlog-main">
                <p className="gf-starlog-body" style={{ opacity: 0.35 }}>Gathering your story from this week.</p>
              </div>
            </div>
          )}

          {!starLogLoading && starLog && (
            <div className="gf-card gf-starlog">
              <div className="gf-starlog-rail" />
              <div className="gf-starlog-aside">
                <div className="gf-starlog-eyebrow"><Icon name="spark" size={12} /> This week&apos;s chapter</div>
                <h2 className="gf-starlog-title">{starLog.chapter_title}</h2>
                {starLog.highlights.length > 0 && (
                  <div className="gf-starlog-tags">
                    {starLog.highlights.map((h, i) => (
                      <span key={i} className="gf-starlog-tag">{h}</span>
                    ))}
                  </div>
                )}
                <div className="gf-starlog-foot">
                  <span><Icon name="check" size={12} stroke={3} /> {starLog.completed_tasks} tasks</span>
                  <span><Icon name="flame" size={12} /> {starLog.completed_days} active days</span>
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
