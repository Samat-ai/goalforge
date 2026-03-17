import confetti from 'canvas-confetti'

// ── Task completion: quick satisfying pop ────────────────────────────────────
function taskPop() {
  confetti({
    particleCount: 60,
    spread: 55,
    origin: { y: 0.65 },
    ticks: 120,
    gravity: 1.2,
    scalar: 0.9,
  })
}

// ── Sprint completion: massive screen-filling burst ──────────────────────────
function sprintBurst() {
  const end = Date.now() + 2_000

  ;(function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 60,
      origin: { x: 0, y: 0.55 },
      colors: ['#f97316', '#fbbf24', '#a78bfa'],
    })
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 60,
      origin: { x: 1, y: 0.55 },
      colors: ['#f97316', '#fbbf24', '#a78bfa'],
    })
    if (Date.now() < end) requestAnimationFrame(frame)
  })()
}

// ── Goal achieved: fireworks show from screen edges ──────────────────────────
function goalFireworks() {
  const duration = 3_000
  const end = Date.now() + duration
  const defaults = { startVelocity: 30, spread: 360, ticks: 80, zIndex: 9999 }

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min
  }

  ;(function frame() {
    const timeLeft = end - Date.now()
    if (timeLeft <= 0) return

    const particleCount = 50 * (timeLeft / duration)

    // Fireworks from random positions along the edges
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      colors: ['#fbbf24', '#f59e0b', '#d97706'],
      shapes: ['star'],
    })
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      colors: ['#a78bfa', '#8b5cf6', '#7c3aed'],
      shapes: ['star'],
    })

    requestAnimationFrame(frame)
  })()
}

// ── Public API ───────────────────────────────────────────────────────────────
export function triggerCelebration(type: 'task' | 'sprint' | 'goal') {
  switch (type) {
    case 'task':   return taskPop()
    case 'sprint': return sprintBurst()
    case 'goal':   return goalFireworks()
  }
}
