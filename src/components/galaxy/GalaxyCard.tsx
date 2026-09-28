import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { useChains } from 'wagmi'
import { List, Orbit } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BLOCKSCOUT } from '@/lib/blockscout'
import { buildGalaxy, layoutGalaxy, type OrbitType } from '@/lib/galaxy'
import { navigate } from '@/lib/route'
import type { BsTx } from '@/lib/wrapped'

const SIZE = 600
const TYPES: { type: OrbitType; label: string; varName: string }[] = [
  { type: 'contract', label: 'Apps & contracts', varName: '--series-1' },
  { type: 'wallet', label: 'Wallets', varName: '--series-2' },
  { type: 'token', label: 'Tokens', varName: '--series-3' },
]
const colorOf = (t: OrbitType) => `var(${TYPES.find((x) => x.type === t)!.varName})`

// Deterministic star field (decoration only, kept faint).
const STARS = Array.from({ length: 70 }, (_, i) => {
  const r = (n: number) => (((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1
  return { x: r(1) * SIZE, y: r(2) * SIZE, s: 0.6 + r(3) * 1.2, d: r(4) * 4 }
})

/** Identity has a shape too, so it never relies on colour alone. */
function Mark({ type, radius }: { type: OrbitType; radius: number }) {
  const common = { fill: colorOf(type), stroke: 'var(--viz-surface)', strokeWidth: 2 }
  if (type === 'wallet') return <circle r={radius} {...common} />
  if (type === 'token')
    return (
      <rect
        x={-radius * 0.8}
        y={-radius * 0.8}
        width={radius * 1.6}
        height={radius * 1.6}
        transform="rotate(45)"
        {...common}
      />
    )
  return <rect x={-radius} y={-radius} width={radius * 2} height={radius * 2} rx={radius * 0.35} {...common} />
}

async function fetchTxs(chainId: number, address: string) {
  const items: BsTx[] = []
  let qs = ''
  for (let page = 0; page < 2; page++) {
    const res = await fetch(`${BLOCKSCOUT[chainId]}/api/v2/addresses/${address}/transactions${qs}`)
    if (res.status === 404) break
    if (!res.ok) throw new Error(`Explorer error ${res.status}`)
    const body = (await res.json()) as { items?: BsTx[]; next_page_params?: Record<string, string | number> | null }
    items.push(...(body.items ?? []))
    if (!body.next_page_params) break
    qs = `?${new URLSearchParams(Object.entries(body.next_page_params).map(([k, v]) => [k, String(v)]))}`
  }
  return items
}

export function GalaxyCard({ address, label }: { address: Address; label?: string }) {
  const chains = useChains().filter((c) => BLOCKSCOUT[c.id] && !c.testnet)
  const [chainId, setChainId] = useState<number>(chains[0]?.id ?? 1)
  const [hover, setHover] = useState<{ i: number; x: number; y: number }>()
  const hovered = hover?.i
  const [asTable, setAsTable] = useState(false)
  const chain = chains.find((c) => c.id === chainId)

  const txs = useQuery({
    queryKey: ['galaxy', chainId, address.toLowerCase()],
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: () => fetchTxs(chainId, address),
  })
  const nodes = useMemo(() => layoutGalaxy(buildGalaxy(address, txs.data ?? []), SIZE), [address, txs.data])

  // Orbit animation: farther planets move slower (ω ∝ r^-1.5). Positions are written straight to the DOM.
  const refs = useRef<(SVGGElement | null)[]>([])
  const paused = useRef(false)
  useEffect(() => {
    paused.current = hovered !== undefined
  }, [hovered])
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let phase = 0
    let raf = 0
    let last = performance.now()
    const place = () =>
      nodes.forEach((n, i) => {
        const a = n.angle + phase * Math.pow((SIZE * 0.17) / n.r, 1.5)
        refs.current[i]?.setAttribute('transform', `translate(${n.cx + n.r * Math.cos(a)} ${n.cy + n.r * Math.sin(a)})`)
      })
    place()
    if (reduced) return
    const tick = (t: number) => {
      if (!paused.current) phase += ((t - last) / 1000) * 0.12
      last = t
      place()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [nodes])

  const hov = hover ? nodes[hover.i] : undefined
  function hoverOn(i: number, el: SVGGElement) {
    const m = el.getAttribute('transform')?.match(/translate\(([-\d.]+) ([-\d.]+)\)/)
    if (m) setHover({ i, x: (Number(m[1]) / SIZE) * 100, y: (Number(m[2]) / SIZE) * 100 })
  }

  function open(i: number) {
    const n = nodes[i]
    if (n.type === 'wallet') navigate({ view: 'view', target: n.address })
    else if (chain?.blockExplorers?.default.url)
      window.open(`${chain.blockExplorers.default.url}/address/${n.address}`, '_blank', 'noopener')
  }

  return (
    <Card className="viz-root md:col-span-2">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1.5">
          <CardTitle className="flex items-center gap-2">
            <Orbit className="text-primary size-5" /> Wallet Galaxy
          </CardTitle>
          <CardDescription>
            Everyone this wallet deals with. Closer and bigger = more transactions. Hover a planet for details.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {chains.map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant={c.id === chainId ? 'default' : 'outline'}
              onClick={() => setChainId(c.id)}
            >
              {c.name}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
            {asTable ? <Orbit /> : <List />} {asTable ? 'Galaxy' : 'List'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* legend: shape + colour + label */}
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
          {TYPES.map((t) => (
            <li key={t.type} className="text-muted-foreground flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="-8 -8 16 16" aria-hidden>
                <Mark type={t.type} radius={5.5} />
              </svg>
              {t.label}
            </li>
          ))}
        </ul>

        {txs.isLoading ? (
          <p className="text-muted-foreground py-16 text-center text-sm">Mapping the galaxy…</p>
        ) : txs.isError ? (
          <p className="text-destructive py-16 text-center text-sm">Couldn’t load transactions from the explorer.</p>
        ) : nodes.length === 0 ? (
          <p className="text-muted-foreground py-16 text-center text-sm">
            An empty galaxy on {chain?.name} — no transactions yet.
          </p>
        ) : asTable ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left">
                <th className="py-2 font-medium">Counterparty</th>
                <th className="py-2 font-medium">Type</th>
                <th className="py-2 text-right font-medium">Sent</th>
                <th className="py-2 text-right font-medium">Received</th>
                <th className="py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((n, i) => (
                <tr key={n.address} className="border-b last:border-0">
                  <td className="py-2">
                    <button className="hover:underline" onClick={() => open(i)}>
                      {n.label}
                    </button>
                  </td>
                  <td className="text-muted-foreground py-2">{TYPES.find((t) => t.type === n.type)!.label}</td>
                  <td className="py-2 text-right tabular-nums">{n.sent}</td>
                  <td className="py-2 text-right tabular-nums">{n.received}</td>
                  <td className="py-2 text-right font-medium tabular-nums">{n.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="galaxy-space relative mx-auto aspect-square w-full max-w-[600px] overflow-hidden rounded-xl">
            <svg
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              className="size-full"
              role="img"
              aria-label={`Wallet galaxy with ${nodes.length} counterparties`}
            >
              <defs>
                <radialGradient id="galaxy-core">
                  <stop offset="0%" stopColor="#fff" />
                  <stop offset="35%" stopColor="var(--brand-via)" />
                  <stop offset="100%" stopColor="var(--brand-from)" stopOpacity="0" />
                </radialGradient>
              </defs>
              {STARS.map((s, i) => (
                <circle
                  key={i}
                  cx={s.x}
                  cy={s.y}
                  r={s.s}
                  className="galaxy-star"
                  style={{ animationDelay: `${s.d}s` }}
                />
              ))}
              {[0.17, 0.26, 0.35, 0.44].map((f) => SIZE * f).map((r) => (
                <circle
                  key={r}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={r}
                  fill="none"
                  stroke="var(--viz-orbit)"
                  strokeWidth={1}
                />
              ))}
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={70}
                fill="url(#galaxy-core)"
                opacity={0.55}
                className="galaxy-pulse"
              />
              <circle cx={SIZE / 2} cy={SIZE / 2} r={22} fill="var(--brand-from)" stroke="#fff" strokeWidth={3} />
              <text
                x={SIZE / 2}
                y={SIZE / 2 + 44}
                textAnchor="middle"
                className="fill-[var(--viz-text)] text-[15px] font-semibold"
              >
                {label ?? 'You'}
              </text>
              {nodes.map((n, i) => (
                <g
                  key={n.address}
                  ref={(el) => {
                    refs.current[i] = el
                  }}
                  className="cursor-pointer"
                  onPointerEnter={(e) => hoverOn(i, e.currentTarget)}
                  onPointerLeave={() => setHover(undefined)}
                  onClick={() => open(i)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${n.label}, ${n.count} transactions`}
                  onFocus={(e) => hoverOn(i, e.currentTarget)}
                  onBlur={() => setHover(undefined)}
                  onKeyDown={(e) => e.key === 'Enter' && open(i)}
                >
                  {/* invisible hit target larger than the mark */}
                  <circle r={Math.max(16, n.radius + 8)} fill="transparent" />
                  <g className={hovered === i ? 'galaxy-hot' : undefined}>
                    <Mark type={n.type} radius={n.radius} />
                  </g>
                  {i < 5 && (
                    <text
                      y={n.radius + 15}
                      textAnchor="middle"
                      className="pointer-events-none fill-[var(--viz-text)] text-[13px] font-medium"
                    >
                      {n.label.length > 16 ? `${n.label.slice(0, 15)}…` : n.label}
                    </text>
                  )}
                </g>
              ))}
            </svg>
            {hov && hover && (
              <div
                className="bg-popover pointer-events-none absolute z-10 w-max max-w-56 -translate-x-1/2 rounded-lg border px-3 py-2 text-xs shadow-lg"
                style={{ left: `${hover.x}%`, top: `calc(${hover.y}% + ${hov.radius + 14}px)` }}
              >
                <p className="font-semibold">{hov.label}</p>
                <p className="text-muted-foreground">{TYPES.find((t) => t.type === hov.type)!.label}</p>
                <p className="mt-1">
                  <strong>{hov.count}</strong> transaction{hov.count === 1 ? '' : 's'} · {hov.sent} sent ·{' '}
                  {hov.received} received
                </p>
                <p className="text-muted-foreground mt-1">
                  {hov.type === 'wallet' ? 'Click to view this wallet' : 'Click to open in the explorer'}
                </p>
              </div>
            )}
          </div>
        )}
        <p className="text-muted-foreground text-xs">
          Based on the latest {txs.data?.length ?? 0} transactions on {chain?.name}.
        </p>
      </CardContent>
    </Card>
  )
}
