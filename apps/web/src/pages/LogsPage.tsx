// pages/LogsPage.tsx — Logs page: balance hero + Star Log + Star Shop.
// Transcribed from design_handoff_goalforge/app/gf-stars.jsx. Mock data
// (data.starLog / data.shopRewards / data.profile.pts) is replaced with real
// hooks: useStarLogQuery (fields match gf-data.jsx:177-184 exactly), useShopRewardsQuery
// + useShopRewardMutations (redeem/create; the prototype's local `adding` toggle stays
// local UI state — there is no backend toggle mutation), useProfileQuery.
import { useState } from 'react'
import { useUser } from '@clerk/react'
import { cx, Icon, Reveal } from '../components/gf/Ui'
import { useProfileQuery, useShopRewardsQuery, useShopRewardMutations, useStarLogQuery } from '../hooks'
import type { ShopReward, StarLogResponse } from '../lib/types'

const isE2EMode = import.meta.env.VITE_E2E_MODE === 'true'
const e2eUserId = import.meta.env.VITE_E2E_USER_ID ?? 'user_e2e'

// ── Star Log (this week's chapter) ──────────────────────────────────────────
function StarLog({ log }: { log: StarLogResponse }) {
  return (
    <Reveal className="gf-card gf-starlog" delay={90}>
      <div className="gf-starlog-rail" />
      <div className="gf-starlog-aside">
        <div className="gf-starlog-eyebrow"><Icon name="spark" size={12} /> This week's chapter</div>
        <h2 className="gf-starlog-title">{log.chapter_title}</h2>
        <div className="gf-starlog-tags">
          {log.highlights.map((h, i) => <span key={i} className="gf-starlog-tag">{h}</span>)}
        </div>
        <div className="gf-starlog-foot">
          <span><Icon name="check" size={12} stroke={3} /> {log.completed_tasks} tasks</span>
          <span><Icon name="flame" size={12} /> {log.completed_days} active days</span>
        </div>
      </div>
      <div className="gf-starlog-main">
        <p className="gf-starlog-body">{log.chapter_body}</p>
      </div>
    </Reveal>
  )
}

function StarLogError({ onRetry }: { onRetry: () => void }) {
  return (
    <Reveal className="gf-nudge is-rose" delay={90}>
      <div className="gf-nudge-body">
        <div className="gf-nudge-kicker">Load error</div>
        <div className="gf-nudge-title">Failed to load your star log.</div>
      </div>
      <button onClick={onRetry} className="gf-btn-ghost-accent">Try again</button>
    </Reveal>
  )
}

function StarLogLoading() {
  return (
    <div role="status" aria-label="Loading star log" style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--ring-track)', borderTop: '2px solid var(--accent)', animation: 'spin 0.75s linear infinite' }} />
    </div>
  )
}

// ── Reward row ───────────────────────────────────────────────────────────────
function RewardRow({ reward, pts, index, onRedeem }: { reward: ShopReward; pts: number; index: number; onRedeem: (reward: ShopReward) => void }) {
  const canRedeem = reward.is_active && pts >= reward.cost
  const shortfall = reward.cost - pts
  const pct = Math.min(1, pts / reward.cost)
  return (
    <Reveal className="gf-reward" delay={140 + index * 60}>
      <div className="gf-reward-ic" aria-hidden="true"><Icon name="spark" size={15} /></div>
      <div className="gf-reward-mid">
        <div className="gf-reward-title">{reward.title}</div>
        <div className="gf-reward-meta">
          <span className="gf-reward-cost"><Icon name="spark" size={11} /> {reward.cost}</span>
          {reward.redemption_count > 0 && <span className="gf-reward-redeemed">redeemed {reward.redemption_count}×</span>}
          {!canRedeem && <span className="gf-reward-need">{shortfall} more</span>}
        </div>
        {!canRedeem && <div className="gf-reward-track"><div className="gf-reward-fill" style={{ width: `${pct * 100}%` }} /></div>}
      </div>
      <button className={cx('gf-reward-btn', canRedeem && 'is-on')} disabled={!canRedeem} onClick={() => canRedeem && onRedeem(reward)}>
        {canRedeem ? 'Redeem' : 'Locked'}
      </button>
    </Reveal>
  )
}

// ── Star Shop ────────────────────────────────────────────────────────────────
function StarShop({
  rewards, pts, addReward, redeemReward,
}: {
  rewards: ShopReward[]
  pts: number
  addReward: (payload: { title: string; cost: number }) => void
  redeemReward: (rewardId: string) => void
}) {
  const [title, setTitle] = useState('')
  const [cost, setCost] = useState('50')
  const [adding, setAdding] = useState(false)

  const add = () => {
    const c = Number(cost)
    if (!title.trim() || !Number.isFinite(c) || c <= 0) return
    addReward({ title: title.trim(), cost: c })
    setTitle('')
    setCost('50')
    setAdding(false)
  }

  return (
    <Reveal className="gf-card gf-shop" delay={120}>
      <div className="gf-shop-head">
        <div>
          <div className="gf-card-cap" style={{ marginBottom: 4 }}>Star Shop</div>
          <h3 className="gf-shop-title">Redeem your momentum</h3>
        </div>
        <span className="gf-shop-bal"><Icon name="spark" size={12} /> {pts} balance</span>
      </div>

      {/* add custom reward */}
      <div className={cx('gf-shop-add', adding && 'is-open')}>
        <div className="gf-shop-addrow">
          <input
            className="gf-input gf-shop-title-in"
            placeholder="Custom reward (e.g. coffee break)"
            maxLength={120}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onFocus={() => setAdding(true)}
            onKeyDown={e => e.key === 'Enter' && add()}
          />
          <div className="gf-shop-costwrap">
            <Icon name="spark" size={12} />
            <input
              className="gf-input gf-shop-cost-in"
              placeholder="50"
              inputMode="numeric"
              aria-label="Cost in stars"
              value={cost}
              onChange={e => setCost(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </div>
          <button className={cx('gf-btn gf-btn-accent gf-shop-addbtn', !title.trim() && 'is-disabled')} onClick={add}>Add</button>
        </div>
      </div>

      {/* reward list */}
      <div className="gf-shop-list">
        {rewards.length === 0
          ? <div className="gf-shop-empty">No rewards yet. Add one to turn stars into something tangible.</div>
          : rewards.map((r, i) => <RewardRow key={r.id} reward={r} pts={pts} index={i} onRedeem={reward => redeemReward(reward.id)} />)}
      </div>
    </Reveal>
  )
}

// ── Logs page ────────────────────────────────────────────────────────────────
export default function LogsPage() {
  const { user } = useUser()
  const userId = user?.id ?? (isE2EMode ? e2eUserId : undefined)

  const { pts } = useProfileQuery(userId)
  const starLogQuery = useStarLogQuery(userId)
  const { rewards } = useShopRewardsQuery(userId)
  const { addReward, redeemReward } = useShopRewardMutations(userId ?? '')

  return (
    <div className="gf-page">
      <Reveal delay={20}>
        <div className="gf-eyebrow">Your journey, in chapters</div>
      </Reveal>

      {starLogQuery.isLoading && <StarLogLoading />}
      {!starLogQuery.isLoading && starLogQuery.isError && (
        <StarLogError onRetry={() => starLogQuery.refetch()} />
      )}
      {!starLogQuery.isLoading && !starLogQuery.isError && starLogQuery.data && (
        <StarLog log={starLogQuery.data} />
      )}

      <StarShop rewards={rewards} pts={pts} addReward={addReward} redeemReward={redeemReward} />
    </div>
  )
}
