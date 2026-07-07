import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import AppHeader from './components/AppHeader'
import CollectionModal from './components/CollectionModal'
import { useProfile } from './hooks/useProfile'

/**
 * Persistent app shell. Render this ONCE as a parent layout route so the header
 * (and its animated nav pill) survives navigation between authed pages instead
 * of unmounting/remounting on every route change.
 *
 * In App.tsx, wrap the authed destinations:
 *
 *   <Route element={<AuthGuard><OnboardingGuard><Layout /></OnboardingGuard></AuthGuard>}>
 *     <Route path="/dashboard" element={<Dashboard />} />
 *     <Route path="/analytics" element={<Analytics />} />
 *     <Route path="/stars"     element={<Stars />} />
 *     <Route path="/coach"     element={<Coach />} />
 *     <Route path="/settings"  element={<Settings />} />
 *   </Route>
 *
 * Then DELETE the <AppHeader/> render from each of those page components — the
 * layout owns it now. Pages keep everything else.
 */
export default function Layout() {
  const [collectionOpen, setCollectionOpen] = useState(false)

  // pts used to be passed into AppHeader by each page. Fetch it once here.
  // ⚠️ Wire this to your real points source (profile / rewards). Placeholder field:
  const { data: profile } = useProfile()
  const pts = profile?.star_points ?? 0

  return (
    <>
      <AppHeader pts={pts} onOpenCollection={() => setCollectionOpen(true)} />
      <main id="main-content">
        <Outlet />
      </main>
      {collectionOpen && <CollectionModal onClose={() => setCollectionOpen(false)} />}
    </>
  )
}
