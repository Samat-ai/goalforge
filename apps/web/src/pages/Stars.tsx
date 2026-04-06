import { useEffect } from 'react'
import { useUser } from '@clerk/react'
import AppHeader from '../components/AppHeader'
import StarShop from '../components/StarShop'
import { T } from '../lib/theme'
import { useProfileQuery, useShopRewardsQuery, useShopRewardMutations } from '../hooks'

const isE2EMode = import.meta.env.VITE_E2E_MODE === 'true'
const e2eUserId = import.meta.env.VITE_E2E_USER_ID ?? 'user_e2e'

export default function Stars() {
  const { user } = useUser()
  const userId = user?.id ?? (isE2EMode ? e2eUserId : undefined)

  const { pts } = useProfileQuery(userId)
  const { rewards: shopRewards } = useShopRewardsQuery(userId)
  const shopMutations = useShopRewardMutations(userId ?? '')

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
