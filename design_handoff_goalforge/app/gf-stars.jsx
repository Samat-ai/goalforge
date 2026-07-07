// gf-stars.jsx — redesigned Stars page: balance hero + Star Log + Star Shop.
const { useState: useStS } = React;

function StarLog({ log }) {
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
  );
}

function RewardRow({ reward, pts, index, onRedeem }) {
  const canRedeem = reward.is_active && pts >= reward.cost;
  const shortfall = reward.cost - pts;
  const pct = Math.min(1, pts / reward.cost);
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
  );
}

function StarShop({ data, onCelebrate }) {
  const [rewards, setRewards] = useStS(data.shopRewards);
  const [pts, setPts] = useStS(data.profile.pts);
  const [title, setTitle] = useStS('');
  const [cost, setCost] = useStS('50');
  const [adding, setAdding] = useStS(false);

  const add = () => {
    const c = Number(cost);
    if (!title.trim() || !Number.isFinite(c) || c <= 0) return;
    setRewards(r => [{ id: 'r' + Date.now(), title: title.trim(), cost: c, redemption_count: 0, is_active: true }, ...r]);
    setTitle(''); setCost('50'); setAdding(false);
  };
  const redeem = (reward) => {
    setPts(p => p - reward.cost);
    setRewards(rs => rs.map(r => r.id === reward.id ? { ...r, redemption_count: r.redemption_count + 1 } : r));
    onCelebrate && onCelebrate();
  };

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
          <input className="gf-input gf-shop-title-in" placeholder="Custom reward (e.g. coffee break)" maxLength={120}
            value={title} onChange={e => setTitle(e.target.value)} onFocus={() => setAdding(true)} onKeyDown={e => e.key === 'Enter' && add()} />
          <div className="gf-shop-costwrap">
            <Icon name="spark" size={12} />
            <input className="gf-input gf-shop-cost-in" placeholder="50" inputMode="numeric" aria-label="Cost in stars"
              value={cost} onChange={e => setCost(e.target.value.replace(/[^0-9]/g, ''))} />
          </div>
          <button className={cx('gf-btn gf-btn-accent gf-shop-addbtn', !title.trim() && 'is-disabled')} onClick={add}>Add</button>
        </div>
      </div>

      {/* reward list */}
      <div className="gf-shop-list">
        {rewards.length === 0
          ? <div className="gf-shop-empty">No rewards yet. Add one to turn stars into something tangible.</div>
          : rewards.map((r, i) => <RewardRow key={r.id} reward={r} pts={pts} index={i} onRedeem={redeem} />)}
      </div>
    </Reveal>
  );
}

function Stars({ data, onCelebrate }) {
  return (
    <div className="gf-page">
      <Reveal delay={20}>
        <div className="gf-eyebrow">Your journey, in chapters</div>
      </Reveal>
      <StarLog log={data.starLog} />
      <StarShop data={data} onCelebrate={onCelebrate} />
    </div>
  );
}

window.Stars = Stars;
