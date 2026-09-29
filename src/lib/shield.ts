import { zeroAddress, type Address } from 'viem'
import { useBalance, useBytecode, useTransactionCount } from 'wagmi'

import type { Contact } from '@/lib/contacts'
import { USDC } from '@/lib/tokens'
import type { ChainId } from '@/lib/wagmi'

export type Finding = {
  level: 'danger' | 'warning' | 'info' | 'ok'
  title: string
  detail?: string
}

const TOKEN_CONTRACTS = new Set(Object.values(USDC).map((a) => a.toLowerCase()))

/**
 * Address poisoning: scammers send dust from an address whose first and last
 * characters match one you use, hoping you copy it from your history.
 */
export function findLookalike(to: Address, known: Address[]) {
  const t = to.toLowerCase()
  return known.find((k) => {
    const a = k.toLowerCase()
    return a !== t && a.slice(2, 6) === t.slice(2, 6) && a.slice(-4) === t.slice(-4)
  })
}

type Params = {
  contacts?: Contact[]
  to?: Address
  chainId?: ChainId
  chainName?: string
  token: string
  self?: Address
  known: Address[]
}

/** Safety checks on a transfer recipient, run before the user signs. */
export function useRecipientShield({ to, chainId, chainName, token, self, known, contacts = [] }: Params) {
  const enabled = !!to && !!chainId
  const query = { enabled }
  const code = useBytecode({ address: to, chainId, query })
  const nonce = useTransactionCount({ address: to, chainId, query })
  const balance = useBalance({ address: to, chainId, query })

  if (!to || !chainId) return { findings: [] as Finding[], loading: false }

  const findings = assessRecipient({
    to,
    chainName,
    token,
    self,
    known,
    contacts,
    onChain: code.isSuccess ? { code: code.data, nonce: nonce.data, balance: balance.data?.value } : undefined,
  })
  return { findings, loading: code.isLoading || nonce.isLoading }
}

/** What the chain says about an address (any field may be missing if the RPC didn't answer). */
export type OnChainFacts = { code?: string; nonce?: number; balance?: bigint }

/**
 * The Scam Shield rules as a pure function, shared by the Send form and the
 * no-wallet Threshold check so both always reach the same verdict.
 */
export function assessRecipient({
  to,
  chainName,
  token,
  self,
  known,
  contacts = [],
  onChain,
}: {
  to: Address
  chainName?: string
  token: string
  self?: Address
  known: Address[]
  contacts?: Contact[]
  onChain?: OnChainFacts
}): Finding[] {
  const findings: Finding[] = []
  const lower = to.toLowerCase()
  const net = chainName ?? 'this network'

  if (to === zeroAddress) {
    findings.push({
      level: 'danger',
      title: 'This is the zero address',
      detail: 'Anything sent here is burned and can never be recovered.',
    })
  }
  if (TOKEN_CONTRACTS.has(lower)) {
    findings.push({
      level: 'danger',
      title: 'This is the USDC token contract itself',
      detail: 'Tokens sent to a token contract are almost always lost forever.',
    })
  }
  const lookalike = findLookalike(to, self ? [self, ...known] : known)
  if (lookalike) {
    findings.push({
      level: 'danger',
      title: 'Look-alike address — possible address-poisoning scam',
      detail: `It starts and ends like ${lookalike.slice(0, 6)}…${lookalike.slice(-4)}${
        lookalike.toLowerCase() === self?.toLowerCase()
          ? ' (your own wallet)'
          : contacts.find((c) => c.address.toLowerCase() === lookalike.toLowerCase())
            ? ` (your contact “${contacts.find((c) => c.address.toLowerCase() === lookalike.toLowerCase())!.name}”)`
            : ', which you sent to before'
      }, but the middle is different. Copy the address from a trusted source, not your history.`,
    })
  }
  if (self && lower === self.toLowerCase()) {
    findings.push({ level: 'info', title: 'You are sending to yourself' })
  }

  const bytecode = onChain?.code
  const nonce = onChain?.nonce
  if (bytecode && bytecode !== '0x') {
    if (bytecode.toLowerCase().startsWith('0xef0100')) {
      findings.push({
        level: 'info',
        title: 'Smart account (EIP-7702)',
        detail: 'A regular wallet upgraded with smart-account features.',
      })
    } else if (!TOKEN_CONTRACTS.has(lower)) {
      findings.push({
        level: 'warning',
        title: 'This address is a smart contract',
        detail: `Only continue if you know it can receive ${token} on ${net} — e.g. a multisig or an exchange deposit address.`,
      })
    }
  } else if (onChain && nonce === 0 && onChain.balance === 0n) {
    findings.push({
      level: 'warning',
      title: `Brand-new address on ${net}`,
      detail: 'It has never sent a transaction and holds nothing here. Double-check every character.',
    })
  } else if (nonce !== undefined && nonce > 0) {
    findings.push({
      level: 'ok',
      title: `Active wallet on ${net}`,
      detail: `${nonce.toLocaleString()} transactions sent from it.`,
    })
  }

  const saved = contacts.find((c) => c.address.toLowerCase() === lower)
  if (saved) findings.push({ level: 'ok', title: `Saved contact: ${saved.name}` })
  else if (!lookalike && known.some((k) => k.toLowerCase() === lower)) {
    findings.push({ level: 'ok', title: "You've sent to this address before" })
  }

  return findings
}
