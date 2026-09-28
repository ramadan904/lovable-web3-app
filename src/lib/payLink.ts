import { isAddress } from 'viem'

export type PayRequest = {
  to: string
  amount: string
  token: 'ETH' | 'USDC'
  chainId: number
  note?: string
}

const MAX_NOTE = 80

export function buildPayLink(req: PayRequest) {
  const params = new URLSearchParams({
    to: req.to,
    amount: req.amount,
    token: req.token,
    chain: String(req.chainId),
  })
  if (req.note?.trim()) params.set('note', req.note.trim().slice(0, MAX_NOTE))
  return `${window.location.origin}${window.location.pathname}#/pay?${params}`
}

/** Validates an incoming request; returns null if anything is malformed. */
export function readPayRequest(params: URLSearchParams | undefined, chainIds: number[]): PayRequest | null {
  if (!params) return null
  const to = params.get('to') ?? ''
  const amount = params.get('amount') ?? ''
  const token = (params.get('token') ?? '').toUpperCase()
  const chainId = Number(params.get('chain'))
  const validTo = isAddress(to) || /^[\w-]+(\.[\w-]+)+$/.test(to)
  if (!validTo) return null
  if (!/^\d*\.?\d+$/.test(amount) || Number(amount) <= 0) return null
  if (token !== 'ETH' && token !== 'USDC') return null
  if (!chainIds.includes(chainId)) return null
  const note = params.get('note')?.slice(0, MAX_NOTE) || undefined
  return { to, amount, token, chainId, note }
}
