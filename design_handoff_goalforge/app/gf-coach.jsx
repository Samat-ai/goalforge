// gf-coach.jsx — redesigned Coach page: a real AI chatbox (intake → forged goal).
const { useState: useCoS, useRef: useCoR, useEffect: useCoE } = React;

// Scripted 5-question intake. Each step: the coach's question + quick-reply chips.
const INTAKE = [
  { q: "Hey, I'm Coach — let's forge a goal that actually fits your life. First: what's something you keep meaning to start but haven't?",
    chips: ['Get fit & run regularly', 'Launch a side project', 'Read more books', 'Learn a language'] },
  { q: 'Love it. Be honest with me — why does this matter to you *right now*?',
    chips: ['I want to feel healthier', 'Prove I can finish things', 'Career growth', 'Just for me'] },
  { q: "Got it. What's gotten in the way before? Knowing the friction helps me design around it.",
    chips: ['No time / too busy', 'I lose motivation', 'Never had a plan', 'I burn out fast'] },
  { q: 'That’s useful. Realistically, how much time can you give this each week?',
    chips: ['2–3 hours', '4–6 hours', '~30 min a day', 'Weekends only'] },
  { q: 'Last one. How will you know you’ve succeeded — what does "done" look like?',
    chips: ['A clear finish line', 'A daily habit sticks', 'A number/metric hit', 'Not sure yet'] },
];

const ACK = [
  'Noted — that’s a strong starting point.',
  'That motivation is exactly what keeps a plan alive.',
  'Thanks for being real about that. I’ll build around it.',
  'Perfect, that tells me how to pace the sprints.',
];

const FORGED = {
  smart_title: 'Run a half-marathon in 16 weeks',
  smart_description: 'Build an aerobic base with 3 runs/week, progressively extending your long run to 21km — designed around your schedule and a tendency to burn out, so it starts gentle and ramps sustainably.',
  type: 'fitness',
  sprints: ['Weeks 1–4: Base — 20km/week', 'Weeks 5–9: Build — add tempo', 'Weeks 10–14: Peak — long-run progression', 'Weeks 15–16: Taper & race'],
  first_tasks: ['3km easy run, twice this week', '10-min mobility after each run', 'Set your race date'],
};

const THINK_VARIANTS = ['shimmer', 'pulse', 'wave'];
function TypingDots() {
  const [variant] = useCoS(() => THINK_VARIANTS[Math.floor(Math.random() * THINK_VARIANTS.length)]);
  return (
    <div className="gf-co-msg gf-co-assistant gf-co-think">
      {variant === 'shimmer' && <span className="gf-think-shimmer">Thinking</span>}
      {variant === 'pulse' && (
        <span className="gf-think-pulse" role="status" aria-label="Thinking"><i></i><span>Thinking</span></span>
      )}
      {variant === 'wave' && (
        <span className="gf-think-wave" role="status" aria-label="Thinking"><i></i><i></i><i></i></span>
      )}
    </div>
  );
}

// Reveals the coach's reply word-by-word, each word softly fading in (ChatGPT-style).
function StreamingText({ content, onTick }) {
  const words = React.useMemo(() => {
    const out = [];
    const parts = content.split(/(\*[^*]+\*)/g);
    for (const seg of parts) {
      if (!seg) continue;
      const italic = seg.length > 1 && seg.startsWith('*') && seg.endsWith('*');
      const text = italic ? seg.slice(1, -1) : seg;
      const toks = text.match(/\S+\s*/g) || [];
      for (const t of toks) out.push({ t, italic });
    }
    return out;
  }, [content]);
  const [count, setCount] = useCoS(0);
  useCoE(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setCount(words.length); onTick && onTick(); return; }
    setCount(0);
    let i = 0;
    const id = setInterval(() => { i += 1; setCount(i); onTick && onTick(); if (i >= words.length) clearInterval(id); }, 42);
    return () => clearInterval(id);
  }, [words]);
  return (
    <span className="gf-co-stream">
      {words.slice(0, count).map((w, idx) => w.italic
        ? <em key={idx} className="gf-co-word">{w.t}</em>
        : <span key={idx} className="gf-co-word">{w.t}</span>)}
    </span>
  );
}

function CoachMsg({ content, animate, stream, onTick }) {
  return (
    <div className={cx('gf-co-msg gf-co-assistant', animate && !stream && 'gf-co-in')}>
      <div className="gf-co-text">
        {stream ? <StreamingText content={content} onTick={onTick} /> : <span dangerouslySetInnerHTML={{ __html: mdItalics(content) }} />}
      </div>
      <div className="gf-co-actions">
        <button className="gf-co-act" aria-label="Copy"><Icon name="check" size={14} /></button>
        <button className="gf-co-act" aria-label="Good"><Icon name="spark" size={14} /></button>
      </div>
    </div>
  );
}

function UserMsg({ content, animate }) {
  return (
    <div className={cx('gf-co-msg gf-co-user', animate && 'gf-co-in')}>
      <div className="gf-co-userbub">{content}</div>
    </div>
  );
}

// minimal *italic* -> <em>
function mdItalics(s) {
  return s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function PlanCard({ onOpen }) {
  return (
    <div className="gf-co-msg gf-co-assistant gf-co-in">
      <div className="gf-co-plan">
        <div className="gf-co-plan-glow" />
        <div className="gf-co-plan-cap"><Icon name="spark" size={12} /> Plan forged · your SMART goal</div>
        <h3 className="gf-co-plan-title">{FORGED.smart_title}</h3>
        <p className="gf-co-plan-desc">{FORGED.smart_description}</p>
        <div className="gf-co-plan-grid">
          <div>
            <div className="gf-co-plan-h">Sprint milestones</div>
            <ul className="gf-co-plan-list">
              {FORGED.sprints.map((s, i) => <li key={i}><span className="gf-co-dot">{i + 1}</span>{s}</li>)}
            </ul>
          </div>
          <div>
            <div className="gf-co-plan-h">Your first tasks</div>
            <ul className="gf-co-plan-list">
              {FORGED.first_tasks.map((t, i) => <li key={i}><span className="gf-co-tick"><Icon name="check" size={11} stroke={3} /></span>{t}</li>)}
            </ul>
          </div>
        </div>
        <div className="gf-co-plan-foot">
          <button className="gf-btn gf-btn-accent" onClick={onOpen}>Add to my goals <Icon name="arrowRight" size={14} /></button>
          <button className="gf-btn gf-btn-soft">Refine plan</button>
        </div>
      </div>
    </div>
  );
}

// Idle Solly: plays the clip on a canvas, luma-keying the black background out to true transparency.
// Idle Solly: a lightweight transparent PNG bobs during cooldown (cheap, GPU-composited),
// and the richer transparent webm clip fades in only for the occasional idle play.
function SollyIdle({ className }) {
  const vidRef = useCoR(null);
  const restRef = useCoR(null);
  useCoE(() => {
    const video = vidRef.current, rest = restRef.current; if (!video) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let timer = 0, alive = true;
    video.muted = true;
    const showClip = (on) => { video.style.opacity = on ? '1' : '0'; if (rest) rest.style.opacity = on ? '0' : '1'; };
    const playOnce = () => {
      if (!alive) return;
      try { video.currentTime = 0; } catch (e) {}
      showClip(true);
      const p = video.play(); if (p && p.catch) p.catch(() => showClip(false));
    };
    const schedule = () => { if (!alive) return; timer = setTimeout(playOnce, 7000 + Math.random() * 9000); };  // ~7–16s
    const onEnded = () => { showClip(false); try { video.currentTime = 0; } catch (e) {} schedule(); };
    video.addEventListener('ended', onEnded);
    if (!reduce) schedule();
    return () => { alive = false; clearTimeout(timer); video.removeEventListener('ended', onEnded); video.pause(); };
  }, []);
  return (
    <div className={className}>
      <img ref={restRef} className="solly-rest" src="assets/solly.png" alt="Solly" />
      <video ref={vidRef} className="solly-clip" muted playsInline preload="auto" aria-hidden="true">
        <source src="assets/solly-idle-alpha.webm" type="video/webm" />
      </video>
    </div>
  );
}

function Coach({ data, onCelebrate }) {
  const [messages, setMessages] = useCoS([]);   // {id, role, content}
  const [step, setStep] = useCoS(-1);            // -1 = not started
  const [typing, setTyping] = useCoS(false);
  const [draft, setDraft] = useCoS('');
  const [done, setDone] = useCoS(false);
  const feedRef = useCoR(null);
  const taRef = useCoR(null);
  const idRef = useCoR(0);
  const nextId = () => ++idRef.current;

  const answered = messages.filter(m => m.role === 'user').length;
  const started = step >= 0;

  useCoE(() => {
    if (feedRef.current) feedRef.current.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, typing, done]);

  const scrollFeed = () => { const f = feedRef.current; if (f) f.scrollTop = f.scrollHeight; };

  const coachSay = (content, after) => {
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages(m => [...m, { id: nextId(), role: 'assistant', content }]);
      after && after();
    }, 900 + Math.random() * 500);
  };

  const start = () => {
    setStep(0);
    coachSay(INTAKE[0].q);
  };

  const submit = (text) => {
    const content = (text ?? draft).trim();
    if (!content || typing || done) return;
    setMessages(m => [...m, { id: nextId(), role: 'user', content }]);
    setDraft('');
    if (taRef.current) taRef.current.style.height = 'auto';
    const cur = step;
    if (cur < INTAKE.length - 1) {
      // acknowledge + next question
      coachSay(`${ACK[cur]} ${INTAKE[cur + 1].q}`, () => setStep(cur + 1));
    } else {
      // final -> forge
      coachSay('That’s everything I need. Give me a second to forge your plan…', () => {
        setTyping(true);
        setTimeout(() => { setTyping(false); setDone(true); onCelebrate && onCelebrate(); }, 1500);
      });
    }
  };

  const grow = (e) => {
    setDraft(e.target.value);
    const el = e.target; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  const curChips = started && step < INTAKE.length ? INTAKE[step].chips : [];
  const showChips = started && !typing && !done && curChips.length > 0 && messages.length > 0 && messages[messages.length - 1].role === 'assistant';

  return (
    <div className="gf-page gf-coach">
      <div className="gf-co-shell">
        {started && (
        <div className="gf-co-head">
          <div className="gf-co-head-l">
            <div className="gf-co-av"><img src="assets/solly.png" alt="Solly" className="gf-co-solly" width={34} height={34} /></div>
            <div>
              <div className="gf-co-head-title">Chat</div>
              <div className="gf-co-head-sub">{done ? 'Plan forged · ready to go' : started ? `Intake · question ${Math.min(step + 1, INTAKE.length)} of ${INTAKE.length}` : 'AI goal coach'}</div>
            </div>
          </div>
          {started && (
            <div className="gf-co-prog" aria-label={`Progress ${answered} of ${INTAKE.length}`}>
              {INTAKE.map((_, i) => <span key={i} className={cx('gf-co-prog-seg', i < answered && 'is-done', i === answered && !done && 'is-cur')} />)}
            </div>
          )}
        </div>
        )}

        <div className="gf-co-feed" ref={feedRef}>
          {!started ? (
            <div className="gf-co-empty">
              <div className="gf-co-empty-av"><SollyIdle className="gf-co-solly-lg" /></div>
              <h2 className="gf-co-empty-title">Let’s forge your next goal</h2>
              <p className="gf-co-empty-sub">Answer five quick questions and I’ll turn your real constraints and motivation into a personalized SMART goal — with sprint milestones and your first week of tasks. Not a motivational speech.</p>
              <div className="gf-co-starters">
                {['I want to get fit', 'Help me finish my side project', 'Build a daily reading habit', 'I keep procrastinating'].map(s => (
                  <button key={s} className="gf-co-starter" onClick={() => { setStep(0); setMessages([{ id: nextId(), role: 'user', content: s }]); coachSay(`${INTAKE[0].q}`, () => setStep(0)); }}>
                    <Icon name="spark" size={14} /> {s}
                  </button>
                ))}
              </div>
              <button className="gf-btn gf-btn-accent gf-co-startbtn" onClick={start}>Start coaching session <Icon name="arrowRight" size={15} /></button>
            </div>
          ) : (
            <div className="gf-co-thread">
              {messages.map((m, i) => {
                const isLast = i === messages.length - 1;
                return m.role === 'assistant'
                  ? <CoachMsg key={m.id} content={m.content} animate={isLast} stream={isLast} onTick={scrollFeed} />
                  : <UserMsg key={m.id} content={m.content} animate={isLast} />;
              })}
              {typing && <TypingDots />}
              {done && <PlanCard onOpen={() => onCelebrate && onCelebrate()} />}
            </div>
          )}
        </div>

        {started && !done && (
          <div className="gf-co-composer">
            {showChips && (
              <div className="gf-co-chips">
                {curChips.map(c => <button key={c} className="gf-co-chip" onClick={() => submit(c)}>{c}</button>)}
              </div>
            )}
            <div className="gf-co-inputbar">
              <textarea ref={taRef} className="gf-co-input" rows={1} placeholder="Answer with concrete details…"
                value={draft} onChange={grow}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} />
              <button className={cx('gf-co-send', draft.trim() && 'is-on')} onClick={() => submit()} aria-label="Send" disabled={!draft.trim() || typing}>
                <Icon name="arrowUp" size={18} stroke={2.4} />
              </button>
            </div>
            <div className="gf-co-hint">Press <kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line</div>
          </div>
        )}
      </div>
    </div>
  );
}

window.Coach = Coach;
