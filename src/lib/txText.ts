import { formatUnits } from 'viem'

import { formatAmount, shortenAddress } from '@/lib/utils'
import type { BsTx } from '@/lib/wrapped'

/** One-line description of a transaction from `owner`'s point of view. */
export function describeTx(tx: BsTx, owner: string) {
  const me = owner.toLowerCase()
  const outgoing = tx.from?.hash?.toLowerCase() === me
  const other = outgoing ? tx.to : tx.from
  const otherLabel = (other && 'name' in other && other.name) || (other?.hash ? shortenAddress(other.hash) : 'a contract')
  let eth = 0
  try {
    eth = Number(formatUnits(BigInt(tx.value ?? '0'), 18))
  } catch {
    // leave 0
  }
  const method = tx.method && !tx.method.startsWith('0x') ? tx.method : undefined
  const failed = tx.status === 'error' ? ' (failed)' : ''
  if (eth > 0)
    return {
      outgoing,
      text: `${outgoing ? 'sent' : 'received'} ${formatAmount(eth)} ETH ${outgoing ? 'to' : 'from'} ${otherLabel}${failed}`,
    }
  if (outgoing) return { outgoing, text: `called ${method ?? 'a function'} on ${otherLabel}${failed}` }
  return { outgoing, text: `was sent a transaction by ${otherLabel}${failed}` }
}

export function timeAgo(ms: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ms) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86_400)}d ago`
}
