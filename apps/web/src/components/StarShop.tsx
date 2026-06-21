import { useState } from 'react'
import type { ShopReward } from '../lib/types'
import Icon from './ui/Icon'

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

  function handleAdd() {
    const costNum = Number(cost)
    if (!title.trim() || !Number.isFinite(costNum) || costNum <= 0) return
    onAdd({ title: title.trim(), cost: costNum })
    setTitle('')
    setCost('50')
  }

  return (
    <div className="gf-card gf-shop">
      <div className="gf-shop-head">
        <div>
          <div className="gf-card-cap" style={{ marginBottom: 4 }}>Star Shop</div>
          <h3 className="gf-shop-title">Redeem your momentum</h3>
        </div>
        <span className="gf-shop-bal"><Icon name="spark" size={12} /> {pts} balance</span>
      </div>

      {/* Add custom reward */}
      <div className="gf-shop-addrow">
        <input
          className="gf-input gf-shop-title-in"
          placeholder="Custom reward (e.g. coffee break)"
          maxLength={120}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
        />
        <div className="gf-shop-costwrap">
          <Icon name="spark" size={12} />
          <input
            className="gf-shop-cost-in"
            placeholder="50"
            inputMode="numeric"
            aria-label="Cost in stars"
            value={cost}
            onChange={e => setCost(e.target.value.replace(/[^0-9]/g, ''))}
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={isCreating || !title.trim()}
          className={['gf-btn gf-btn-accent gf-shop-addbtn', !title.trim() ? 'is-disabled' : ''].filter(Boolean).join(' ')}
          style={{ cursor: isCreating ? 'wait' : 'pointer' }}
        >
          Add
        </button>
      </div>

      {/* Reward list */}
      <div className="gf-shop-list">
        {rewards.length === 0 && (
          <div className="gf-shop-empty">
            No rewards yet. Add one to turn stars into something tangible.
          </div>
        )}
        {rewards.map((reward, i) => {
          const canRedeem = reward.is_active && pts >= reward.cost
          const shortfall = reward.cost - pts
          const pct = Math.min(1, pts / reward.cost)
          return (
            <div key={reward.id} className="gf-reward" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="gf-reward-ic" aria-hidden="true"><Icon name="spark" size={15} /></div>
              <div className="gf-reward-mid">
                <div className="gf-reward-title">{reward.title}</div>
                <div className="gf-reward-meta">
                  <span className="gf-reward-cost"><Icon name="spark" size={11} /> {reward.cost}</span>
                  {reward.redemption_count > 0 && (
                    <span className="gf-reward-redeemed">redeemed {reward.redemption_count}×</span>
                  )}
                  {!canRedeem && shortfall > 0 && (
                    <span className="gf-reward-need">{shortfall} more</span>
                  )}
                </div>
                {!canRedeem && (
                  <div className="gf-reward-track">
                    <div className="gf-reward-fill" style={{ width: `${pct * 100}%` }} />
                  </div>
                )}
              </div>
              <button
                onClick={() => canRedeem && !isRedeeming && onRedeem(reward.id)}
                disabled={!canRedeem || isRedeeming}
                className={['gf-reward-btn', canRedeem ? 'is-on' : ''].filter(Boolean).join(' ')}
              >
                {canRedeem ? 'Redeem' : 'Locked'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
