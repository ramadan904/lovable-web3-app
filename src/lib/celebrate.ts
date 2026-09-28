import confetti from 'canvas-confetti'

const BRAND = ['#7c3aed', '#c026d3', '#ec4899', '#fb923c', '#facc15']

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** A short brand-coloured confetti burst for real wins (confirmed send, lock created…). */
export function celebrate(kind: 'small' | 'big' = 'small') {
  if (reducedMotion()) return
  const base = { colors: BRAND, disableForReducedMotion: true, zIndex: 60 }
  if (kind === 'small') {
    confetti({ ...base, particleCount: 90, spread: 70, startVelocity: 38, origin: { y: 0.7 } })
    return
  }
  const end = Date.now() + 900
  ;(function frame() {
    confetti({ ...base, particleCount: 6, angle: 60, spread: 60, origin: { x: 0, y: 0.75 } })
    confetti({ ...base, particleCount: 6, angle: 120, spread: 60, origin: { x: 1, y: 0.75 } })
    if (Date.now() < end) requestAnimationFrame(frame)
  })()
}
