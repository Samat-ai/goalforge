import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useUser } from '@clerk/react'
import AppHeader from './components/AppHeader'
import CollectionModal from './components/CollectionModal'
import { useProfileQuery } from './hooks'
import { useRewardsQuery, useEquipRewardMutation } from './hooks/useRewards'

export default function Layout() {
  const [collectionOpen, setCollectionOpen] = useState(false)
  const { user } = useUser()
  const userId = user?.id ?? ''
  const { pts } = useProfileQuery(userId || undefined)
  const { data: rewards = [] } = useRewardsQuery(userId)
  const equipMutation = useEquipRewardMutation(userId)

  return (
    <>
      <AppHeader pts={pts} onOpenCollection={() => setCollectionOpen(true)} />
      <main id="main-content">
        <Outlet />
      </main>
      {collectionOpen && (
        <CollectionModal
          rewards={rewards}
          onEquip={(rewardId) => equipMutation.mutate(rewardId)}
          onClose={() => setCollectionOpen(false)}
        />
      )}
    </>
  )
}
