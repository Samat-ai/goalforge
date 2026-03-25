import { useState } from 'react'
import { T } from '../lib/theme'
import type { ShopReward } from '../lib/types'

interface StarShopProps {
  pts: number
  rewards: ShopReward[]
  onAdd: (payload: { title: string; cost: number }) => void
  onRedeem: (rewardId: string) => void
  isCreating: boolean
  isRedeeming: boolean
}

export default function StarShop({ pts, rewards, onAdd, onRedeem, isCreating, isRedeeming }: StarShopProps) {
  const [title, setTitle] = useState('')
  const [cost, setCost] = useState('50')

  return (
    <section style={{
      marginTop: 14,
      marginBottom: 20,
      border: `1px solid ${T.border}`,
      background: T.card,
      borderRadius: 12,
      padding: '14px 14px 12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, letterSpacing: '0.08em' }}>STAR SHOP</div>
          <h3 style={{ fontFamily: T.serif, fontSize: 18, fontWeight: 500, color: T.text }}>Redeem your momentum</h3>
        </div>
        <div style={{ fontFamily: T.mono, fontSize: 12, color: T.amber }}>Balance: {pts} pts</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Custom reward (e.g. Coffee break)"
          maxLength={120}
          style={{
            flex: 1,
            minWidth: 220,
            minHeight: 44,
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            padding: '10px 12px',
            color: T.text,
            fontFamily: T.mono,
            fontSize: 12,
          }}
        />
        <input
          value={cost}
          onChange={e => setCost(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="Cost"
          inputMode="numeric"
          style={{
            width: 96,
            minHeight: 44,
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            padding: '10px 12px',
            color: T.text,
            fontFamily: T.mono,
            fontSize: 12,
          }}
        />
        <button
          onClick={() => {
            const costNum = Number(cost)
            if (!title.trim() || !Number.isFinite(costNum) || costNum <= 0) return
            onAdd({ title: title.trim(), cost: costNum })
            setTitle('')
            setCost('50')
          }}
          disabled={isCreating}
          style={{
            minHeight: 44,
            minWidth: 44,
            border: 'none',
            borderRadius: 8,
            padding: '0 14px',
            cursor: isCreating ? 'default' : 'pointer',
            background: `${T.indigo}22`,
            color: T.indigo,
            fontFamily: T.mono,
            fontSize: 11,
            letterSpacing: '0.05em',
            opacity: isCreating ? 0.6 : 1,
          }}
        >
          Add Reward
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {rewards.length === 0 && (
          <div style={{ fontFamily: T.mono, fontSize: 12, color: T.textDim }}>
            No custom rewards yet. Add one to turn stars into something tangible.
          </div>
        )}
        {rewards.map(reward => {
          const canRedeem = reward.is_active && pts >= reward.cost
          return (
            <div key={reward.id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              background: T.surface,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: T.serif, fontSize: 15, color: T.text }}>{reward.title}</div>
                <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim }}>
                  {reward.cost} pts · redeemed {reward.redemption_count}x
                </div>
              </div>
              <button
                onClick={() => onRedeem(reward.id)}
                disabled={!canRedeem || isRedeeming}
                style={{
                  minHeight: 44,
                  minWidth: 44,
                  border: `1px solid ${canRedeem ? T.emerald : T.border}`,
                  borderRadius: 8,
                  background: canRedeem ? `${T.emerald}15` : `${T.border}20`,
                  color: canRedeem ? T.emerald : T.textDim,
                  cursor: canRedeem ? 'pointer' : 'default',
                  fontFamily: T.mono,
                  fontSize: 11,
                  letterSpacing: '0.05em',
                  padding: '0 12px',
                }}
              >
                Redeem
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
