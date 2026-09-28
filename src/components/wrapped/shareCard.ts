import type { WrappedStats } from '@/lib/wrapped'

type CardInput = { stats: WrappedStats; label: string; chainName: string; feesText: string }

/** Draws a 1080×1350 share image (Instagram/X portrait) and returns a PNG data URL. */
export function drawShareCard({ stats, label, chainName, feesText }: CardInput) {
  const W = 1080
  const H = 1350
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#1e1b4b')
  bg.addColorStop(0.55, '#6d28d9')
  bg.addColorStop(1, '#db2777')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // soft glow
  const glow = ctx.createRadialGradient(W * 0.8, H * 0.15, 0, W * 0.8, H * 0.15, 520)
  glow.addColorStop(0, 'rgba(255,255,255,0.25)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  const font = (size: number, weight = 700) =>
    `${weight} ${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'top'

  ctx.font = font(34, 600)
  ctx.globalAlpha = 0.8
  ctx.fillText(`WALLET WRAPPED · ${chainName.toUpperCase()}`, 80, 80)
  ctx.globalAlpha = 1
  ctx.font = font(44, 600)
  ctx.fillText(label, 80, 130)

  ctx.font = font(150, 400)
  ctx.fillText(stats.persona.emoji, 80, 250)
  ctx.font = font(96, 800)
  ctx.fillText(stats.persona.title, 80, 430)
  ctx.font = font(36, 500)
  ctx.globalAlpha = 0.85
  wrap(ctx, stats.persona.blurb, 80, 550, W - 160, 48)
  ctx.globalAlpha = 1

  const tiles: [string, string][] = [
    [stats.totalTx.toLocaleString(), 'transactions'],
    [stats.ageDays !== undefined ? `${stats.firstSeenIsExact ? '' : '≥ '}${stats.ageDays.toLocaleString()}` : '—', 'days on-chain'],
    [stats.tokenTransfers.toLocaleString(), 'token transfers'],
    [feesText, `fees (last ${stats.sampleSize} txs)`],
  ]
  tiles.forEach(([value, caption], i) => {
    const x = 80 + (i % 2) * 470
    const y = 740 + Math.floor(i / 2) * 230
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    roundRect(ctx, x, y, 440, 200, 28)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = font(fit(ctx, value, 380, 72), 800)
    ctx.fillText(value, x + 32, y + 36)
    ctx.font = font(30, 500)
    ctx.globalAlpha = 0.8
    ctx.fillText(caption, x + 32, y + 136)
    ctx.globalAlpha = 1
  })

  ctx.font = font(30, 600)
  ctx.globalAlpha = 0.75
  ctx.fillText(window.location.host + window.location.pathname, 80, H - 100)
  ctx.globalAlpha = 1

  return canvas.toDataURL('image/png')
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, size: number) {
  let s = size
  do {
    ctx.font = `800 ${s}px ui-sans-serif, system-ui, sans-serif`
    if (ctx.measureText(text).width <= maxWidth) break
    s -= 4
  } while (s > 28)
  return s
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  let line = ''
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y)
      line = word
      y += lineHeight
    } else line = test
  }
  ctx.fillText(line, x, y)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
