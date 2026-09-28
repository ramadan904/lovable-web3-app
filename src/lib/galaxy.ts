import type { BsTx } from '@/lib/wrapped'

export type OrbitType = 'contract' | 'wallet' | 'token'

export type Orbiter = {
  address: string
  label: string
  type: OrbitType
  count: number
  sent: number
  received: number
}

const TOKEN_METHODS = /^(transfer|transferFrom|approve|increaseAllowance|permit)$/i

/** Groups a wallet's transactions by counterparty, most frequent first. */
export function buildGalaxy(owner: string, txs: BsTx[], limit = 24): Orbiter[] {
  const me = owner.toLowerCase()
  const byAddr = new Map<string, Orbiter & { methods: Set<string>; isContract?: boolean }>()
  for (const tx of txs) {
    const from = tx.from?.hash?.toLowerCase()
    const to = tx.to?.hash?.toLowerCase()
    const outgoing = from === me
    const other = (outgoing ? tx.to : tx.from) as
      | { hash?: string; name?: string | null; is_contract?: boolean | null }
      | null
      | undefined
    const key = outgoing ? to : from
    if (!key || key === me || !other?.hash) continue
    let o = byAddr.get(key)
    if (!o) {
      o = {
        address: other.hash,
        label: other.name || `${other.hash.slice(0, 6)}…${other.hash.slice(-4)}`,
        type: 'wallet',
        count: 0,
        sent: 0,
        received: 0,
        methods: new Set<string>(),
        isContract: other.is_contract ?? undefined,
      }
      byAddr.set(key, o)
    }
    o.count++
    if (outgoing) o.sent++
    else o.received++
    if (outgoing && tx.method && !tx.method.startsWith('0x')) o.methods.add(tx.method)
  }
  return [...byAddr.values()]
    .map(({ methods, isContract, ...o }) => {
      const tokenish = methods.size > 0 && [...methods].every((m) => TOKEN_METHODS.test(m))
      const type: OrbitType = isContract ? (tokenish ? 'token' : 'contract') : 'wallet'
      return { ...o, type }
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit)
}

/** Polar layout: more interactions → closer orbit; golden-angle spacing avoids clumps. */
export function layoutGalaxy(orbiters: Orbiter[], size: number) {
  const c = size / 2
  const maxCount = Math.max(1, ...orbiters.map((o) => o.count))
  const minR = size * 0.17
  const maxR = size * 0.44
  const golden = Math.PI * (3 - Math.sqrt(5))
  return orbiters.map((o, i) => {
    const t = orbiters.length > 1 ? i / (orbiters.length - 1) : 0
    const r = minR + (maxR - minR) * Math.pow(t, 0.85)
    const angle = i * golden
    const radius = 5 + 13 * Math.sqrt(o.count / maxCount)
    return { ...o, r, angle, radius, cx: c, cy: c }
  })
}
