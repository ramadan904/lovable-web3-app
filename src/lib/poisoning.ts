// Address-poisoning detection over a wallet's token-transfer history.

type Party = { hash?: string | null } | null | undefined

export type BsTransfer = {
  from?: Party
  to?: Party
  timestamp?: string | null
  transaction_hash?: string | null
  tx_hash?: string | null
  token?: { symbol?: string | null; decimals?: string | number | null } | null
  total?: { value?: string | null; decimals?: string | number | null } | null
}

export type PoisonAttempt = {
  hash: string
  attacker: string
  imitates: string
  symbol: string
  zeroValue: boolean
  time?: Date
}

const lc = (h?: string | null) => (h ?? '').toLowerCase()
const looksLike = (a: string, b: string) => a !== b && a.slice(2, 6) === b.slice(2, 6) && a.slice(-4) === b.slice(-4)

function isZero(t: BsTransfer) {
  try {
    return BigInt(t.total?.value ?? '0') === 0n
  } catch {
    return false
  }
}

/**
 * Finds transfers whose counterparty imitates an address the owner really uses.
 * "Really uses" = received a non-zero transfer from the owner, or is in `trusted` (contacts, app history).
 */
export function detectPoisoning(owner: string, transfers: BsTransfer[], trusted: string[] = []): PoisonAttempt[] {
  const me = lc(owner)
  const known = new Set(trusted.map(lc))
  for (const t of transfers) if (lc(t.from?.hash) === me && !isZero(t) && t.to?.hash) known.add(lc(t.to.hash))
  known.delete(me)

  const attempts: PoisonAttempt[] = []
  const seen = new Set<string>()
  for (const t of transfers) {
    const from = lc(t.from?.hash)
    const to = lc(t.to?.hash)
    const counterparty = from === me ? to : to === me ? from : ''
    if (!counterparty || known.has(counterparty)) continue
    const imitates = [...known, me].find((k) => looksLike(counterparty, k))
    if (!imitates) continue
    const hash = t.transaction_hash ?? t.tx_hash ?? ''
    const key = `${hash}:${counterparty}`
    if (seen.has(key)) continue
    seen.add(key)
    const time = t.timestamp ? new Date(t.timestamp) : undefined
    attempts.push({
      hash,
      attacker: counterparty,
      imitates,
      symbol: t.token?.symbol || 'tokens',
      zeroValue: isZero(t),
      time: time && !Number.isNaN(time.getTime()) ? time : undefined,
    })
  }
  return attempts
}

export type HealthInput = {
  dangerApprovals: number
  warningApprovals: number
  poisonAttempts: number
  spamTokens: number
}

export type HealthItem = { ok: boolean; text: string; penalty: number }

/** 100-point score: approvals and poisoning weigh most; spam tokens a little. */
export function scoreHealth(h: HealthInput) {
  const items: HealthItem[] = [
    {
      ok: h.dangerApprovals === 0,
      text: h.dangerApprovals
        ? `${h.dangerApprovals} dangerous approval${h.dangerApprovals > 1 ? 's' : ''} — revoke now`
        : 'No approvals to wallets or other drainer patterns',
      penalty: Math.min(45, h.dangerApprovals * 25),
    },
    {
      ok: h.warningApprovals === 0,
      text: h.warningApprovals
        ? `${h.warningApprovals} risky approval${h.warningApprovals > 1 ? 's' : ''} (unlimited, unverified or NFT-wide)`
        : 'No unlimited or unverified approvals',
      penalty: Math.min(30, h.warningApprovals * 6),
    },
    {
      ok: h.poisonAttempts === 0,
      text: h.poisonAttempts
        ? `${h.poisonAttempts} address-poisoning attempt${h.poisonAttempts > 1 ? 's' : ''} in your history — never copy addresses from it`
        : 'No address-poisoning attempts found',
      penalty: Math.min(20, h.poisonAttempts * 8),
    },
    {
      ok: h.spamTokens === 0,
      text: h.spamTokens
        ? `${h.spamTokens} scam token${h.spamTokens > 1 ? 's' : ''} airdropped to you — ignore, never visit their sites`
        : 'No scam tokens',
      penalty: Math.min(10, h.spamTokens * 2),
    },
  ]
  const score = Math.max(0, 100 - items.reduce((s, i) => s + i.penalty, 0))
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F'
  return { score, grade, items }
}
