import { useSyncExternalStore } from 'react'

import type { ChainId } from '@/lib/wagmi'

export type SendDraft = {
  to?: string
  amount?: string
  token?: 'ETH' | 'USDC'
  chainId?: ChainId
  /** Increments on every fill so the same draft can be applied twice. */
  seq: number
}

let draft: SendDraft = { seq: 0 }
const listeners = new Set<() => void>()

/** Pre-fill the Send form from elsewhere in the app (e.g. the command bar). */
export function fillSendDraft(next: Omit<SendDraft, 'seq'>) {
  draft = { ...next, seq: draft.seq + 1 }
  listeners.forEach((l) => l())
  document.getElementById('send')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function useSendDraft() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => draft,
  )
}
