// Turns a Blockscout transaction into a plain-English explanation.

type Addr = { hash?: string | null; name?: string | null; is_contract?: boolean | null } | null | undefined

export type BsTokenTransfer = {
  from?: Addr
  to?: Addr
  type?: string | null
  token?: {
    symbol?: string | null
    name?: string | null
    decimals?: string | number | null
    type?: string | null
    address_hash?: string
    address?: string
  } | null
  total?: { value?: string | null; decimals?: string | number | null; token_id?: string | null } | null
}

export type BsTxDetail = {
  hash: string
  status?: string | null
  result?: string | null
  revert_reason?: unknown
  timestamp?: string | null
  from?: Addr
  to?: Addr
  value?: string | null
  fee?: { value?: string | null } | null
  method?: string | null
  decoded_input?: {
    method_call?: string | null
    parameters?: { name?: string; type?: string; value?: unknown }[]
  } | null
  token_transfers?: BsTokenTransfer[] | null
}

export type Movement = { direction: 'out' | 'in' | 'other'; amount: string; symbol: string; counterparty: string }

export type Explanation = {
  headline: string
  ok: boolean
  failureReason?: string
  movements: Movement[]
  ethValue: number
  feeEth: number
  method?: string
  warnings: string[]
}

const UNLIMITED = 2n ** 255n
const short = (h?: string | null) => (h ? `${h.slice(0, 6)}…${h.slice(-4)}` : 'unknown')
const label = (a: Addr) => a?.name || short(a?.hash)
const same = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase()

function units(value: string | null | undefined, decimals: string | number | null | undefined) {
  try {
    const v = BigInt(value ?? '0')
    const d = Number(decimals ?? 18)
    const n = Number(v) / 10 ** (Number.isFinite(d) ? d : 18)
    return n.toLocaleString(undefined, { maximumFractionDigits: n < 1 ? 6 : 4 })
  } catch {
    return '?'
  }
}

function describeTransfer(t: BsTokenTransfer) {
  const kind = t.token?.type ?? ''
  const symbol = t.token?.symbol || t.token?.name || 'tokens'
  if (kind === 'ERC-721') return { amount: '1', symbol: `${symbol}${t.total?.token_id ? ` #${t.total.token_id}` : ''}` }
  return { amount: units(t.total?.value, t.total?.decimals ?? t.token?.decimals), symbol }
}

const join = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`

function param(tx: BsTxDetail, index: number) {
  return tx.decoded_input?.parameters?.[index]?.value
}

export function explainTx(tx: BsTxDetail): Explanation {
  const sender = tx.from?.hash
  const ok = tx.status !== 'error'
  const ethValue = Number(units(tx.value, 18).replace(/,/g, '')) || 0
  const feeEth = Number(units(tx.fee?.value, 18).replace(/,/g, '')) || 0
  const methodCall = tx.decoded_input?.method_call ?? undefined
  const method = tx.method && !tx.method.startsWith('0x') ? tx.method : methodCall?.split('(')[0]
  const warnings: string[] = []

  const transfers = tx.token_transfers ?? []
  const movements: Movement[] = transfers.map((t) => {
    const { amount, symbol } = describeTransfer(t)
    const direction = same(t.from?.hash, sender) ? 'out' : same(t.to?.hash, sender) ? 'in' : 'other'
    const counterparty =
      direction === 'out' ? label(t.to) : direction === 'in' ? label(t.from) : `${label(t.from)} → ${label(t.to)}`
    return { direction, amount, symbol, counterparty }
  })
  const out = movements.filter((m) => m.direction === 'out').map((m) => `${m.amount} ${m.symbol}`)
  const inn = movements.filter((m) => m.direction === 'in').map((m) => `${m.amount} ${m.symbol}`)
  if (ethValue > 0) out.unshift(`${units(tx.value, 18)} ETH`)
  const via = tx.to?.is_contract && tx.to?.name ? ` via ${tx.to.name}` : ''
  const token = tx.to?.name || short(tx.to?.hash)

  let headline: string
  if (method === 'approve') {
    const spender = String(param(tx, 0) ?? '')
    let amount = 'some'
    try {
      const raw = BigInt(String(param(tx, 1) ?? '0'))
      amount = raw >= UNLIMITED ? 'UNLIMITED' : raw === 0n ? 'zero (revoked)' : 'a limited amount of'
      if (raw >= UNLIMITED)
        warnings.push(
          `Unlimited approval: ${short(spender)} can take all of this token at any time. Revoke it in Approval Guard if you don't need it.`,
        )
    } catch {
      // leave generic
    }
    headline =
      amount === 'zero (revoked)'
        ? `Revoked ${short(spender)}’s access to ${token}`
        : `Approved ${short(spender)} to spend ${amount} ${token}`
  } else if (method === 'setApprovalForAll') {
    const operator = String(param(tx, 0) ?? '')
    const granted = String(param(tx, 1)) === 'true'
    headline = granted
      ? `Gave ${short(operator)} control of every NFT in ${token}`
      : `Removed ${short(operator)}’s access to ${token} NFTs`
    if (granted)
      warnings.push(
        'Collection-wide NFT access is how most NFT drains happen. Only grant it to marketplaces you trust.',
      )
  } else if (inn.length && transfers.some((t) => t.type === 'token_minting')) {
    headline = `Minted ${join(inn)}${ethValue > 0 ? ` for ${units(tx.value, 18)} ETH` : ''}${via}`
  } else if (out.length && inn.length) {
    headline = `Swapped ${join(out)} for ${join(inn)}${via}`
  } else if (inn.length) {
    headline = `Received ${join(inn)}${via}`
  } else if (out.length) {
    const firstOut = movements.find((m) => m.direction === 'out')
    const to = firstOut?.counterparty ?? label(tx.to)
    headline = `Sent ${join(out)} to ${to}`
  } else if (method) {
    headline = `Called ${method} on ${label(tx.to)}`
  } else {
    headline = `Interacted with ${label(tx.to)}`
  }

  let failureReason: string | undefined
  if (!ok) {
    const reason =
      typeof tx.revert_reason === 'string'
        ? tx.revert_reason
        : tx.result && tx.result !== 'success'
          ? tx.result
          : undefined
    failureReason = reason || 'The transaction reverted; nothing moved except the fee.'
    headline = `Failed: ${headline.charAt(0).toLowerCase()}${headline.slice(1)}`
  }
  if (tx.to && tx.to.is_contract === false && transfers.length === 0 && ethValue === 0 && tx.decoded_input)
    warnings.push('Called a function on an address that is not a contract.')

  return { headline, ok, failureReason, movements, ethValue, feeEth, method, warnings }
}
