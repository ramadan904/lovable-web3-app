// Pure stats for Wallet Wrapped, computed from Blockscout data.

export type BsTx = {
  hash: string
  timestamp: string
  from?: { hash: string } | null
  to?: { hash: string; name?: string | null; is_contract?: boolean } | null
  value?: string | null
  fee?: { value?: string | null } | null
  status?: string | null
  method?: string | null
}

export type Counters = {
  transactions_count?: string | number | null
  token_transfers_count?: string | number | null
}

export type Persona = { title: string; emoji: string; blurb: string }

export type WrappedStats = {
  totalTx: number
  tokenTransfers: number
  sampleSize: number
  firstSeen?: Date
  firstSeenIsExact: boolean
  ageDays?: number
  topPlace?: { address: string; name?: string; count: number }
  busiestHour?: number
  busiestWeekday?: string
  feesWei: bigint
  biggestSendWei: bigint
  failRate: number
  persona: Persona
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
// Matched against contract names and decoded method names (never raw 0x selectors).
const DEX = /router|swap|uniswap|aerodrome|sushi|curve|1inch|cowswap|paraswap|balancer|odos/i
const NFT = /seaport|opensea|blur|zora|magic ?eden|nft|erc721|mint/i
const BRIDGE = /bridge|portal|across|stargate|\bhop\b|relay|layerzero/i

const num = (v: string | number | null | undefined) => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}
const big = (v: string | null | undefined) => {
  try {
    return BigInt(v ?? '0')
  } catch {
    return 0n
  }
}

function mode<T>(values: T[]): [T, number] | undefined {
  const counts = new Map<T, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best: [T, number] | undefined
  for (const entry of counts) if (!best || entry[1] > best[1]) best = entry
  return best
}

export function computeWrapped(
  address: string,
  counters: Counters,
  recent: BsTx[],
  oldest?: BsTx,
  now = new Date(),
): WrappedStats {
  const me = address.toLowerCase()
  const outgoing = recent.filter((t) => t.from?.hash?.toLowerCase() === me)
  const totalTx = Math.max(num(counters.transactions_count), recent.length)
  const tokenTransfers = num(counters.token_transfers_count)

  // Oldest timestamp we know of: the explicit oldest tx if we got one, else the oldest in the sample.
  const times = recent.map((t) => new Date(t.timestamp)).filter((d) => !Number.isNaN(d.getTime()))
  const sampleOldest = times.length ? new Date(Math.min(...times.map((d) => d.getTime()))) : undefined
  const exact = oldest ? new Date(oldest.timestamp) : undefined
  const firstSeen = exact && !Number.isNaN(exact.getTime()) ? exact : sampleOldest
  const firstSeenIsExact = !!exact || recent.length >= totalTx
  const ageDays = firstSeen ? Math.max(0, Math.floor((now.getTime() - firstSeen.getTime()) / 86_400_000)) : undefined

  const places = outgoing.filter((t) => t.to?.hash)
  const top = mode(places.map((t) => t.to!.hash.toLowerCase()))
  const topTx = top ? places.find((t) => t.to!.hash.toLowerCase() === top[0]) : undefined
  const topPlace = top ? { address: topTx!.to!.hash, name: topTx!.to!.name ?? undefined, count: top[1] } : undefined

  const hours = mode(times.map((d) => d.getHours()))
  const days = mode(times.map((d) => d.getDay()))

  const feesWei = outgoing.reduce((s, t) => s + big(t.fee?.value), 0n)
  const biggestSendWei = outgoing.reduce((m, t) => (big(t.value) > m ? big(t.value) : m), 0n)
  const failed = outgoing.filter((t) => t.status === 'error').length
  const failRate = outgoing.length ? failed / outgoing.length : 0

  const labels = places.map((t) => `${t.to?.name ?? ''} ${t.method && !t.method.startsWith('0x') ? t.method : ''}`)
  const share = (re: RegExp) => (labels.length ? labels.filter((l) => re.test(l)).length / labels.length : 0)

  const persona = pickPersona({
    totalTx,
    ageDays,
    hour: hours?.[0],
    failRate,
    dex: share(DEX),
    nft: share(NFT),
    bridge: share(BRIDGE),
    tokenTransfers,
  })

  return {
    totalTx,
    tokenTransfers,
    sampleSize: recent.length,
    firstSeen,
    firstSeenIsExact,
    ageDays,
    topPlace,
    busiestHour: hours?.[0],
    busiestWeekday: days ? WEEKDAYS[days[0]] : undefined,
    feesWei,
    biggestSendWei,
    failRate,
    persona,
  }
}

export function pickPersona(s: {
  totalTx: number
  ageDays?: number
  hour?: number
  failRate: number
  dex: number
  nft: number
  bridge: number
  tokenTransfers: number
}): Persona {
  if (s.totalTx === 0)
    return { title: 'Blank Canvas', emoji: '🥚', blurb: 'No transactions yet. Every legend starts somewhere.' }
  if (s.totalTx >= 5000)
    return { title: 'Bot-Level Grinder', emoji: '🤖', blurb: 'Thousands of transactions. Are you even human?' }
  if (s.dex >= 0.4) return { title: 'DEX Degen', emoji: '🔄', blurb: 'Swapping is your cardio. The router knows you by name.' }
  if (s.nft >= 0.3) return { title: 'NFT Collector', emoji: '🖼️', blurb: 'Your wallet is basically a gallery.' }
  if (s.bridge >= 0.3) return { title: 'Chain Hopper', emoji: '🌉', blurb: 'One chain is never enough for you.' }
  if (s.failRate >= 0.15)
    return { title: 'Fearless Clicker', emoji: '💥', blurb: 'Failed transactions don’t scare you. Send first, ask later.' }
  if (s.hour !== undefined && s.hour >= 0 && s.hour < 5)
    return { title: 'Night Owl', emoji: '🦉', blurb: 'Most active while everyone else is asleep.' }
  if (s.ageDays !== undefined && s.ageDays >= 3 * 365 && s.totalTx < 200)
    return { title: 'Diamond Hands', emoji: '💎', blurb: 'Years on-chain, few moves. Patience is your alpha.' }
  if (s.totalTx >= 1000) return { title: 'Power User', emoji: '⚡', blurb: 'Over a thousand transactions and counting.' }
  if (s.ageDays !== undefined && s.ageDays < 90)
    return { title: 'Fresh Explorer', emoji: '🌱', blurb: 'New on-chain and already moving.' }
  return { title: 'On-chain Regular', emoji: '🧭', blurb: 'Steady, reliable, always around.' }
}

export function hourLabel(hour: number) {
  const h = hour % 12 === 0 ? 12 : hour % 12
  return `${h} ${hour < 12 ? 'AM' : 'PM'}`
}
