import { useCallback, useSyncExternalStore } from 'react'
import type { Address, Hash } from 'viem'

export type ActivityItem = {
  hash: Hash
  chainId: number
  token: 'ETH' | 'USDC'
  amount: string
  to: Address
  time: number
}

// Transactions sent from this app, kept in this browser only (per address).
const MAX_ITEMS = 20
const EVENT = 'activity-changed'
const EMPTY: ActivityItem[] = []
const cache = new Map<string, { raw: string | null; items: ActivityItem[] }>()

const storageKey = (address: Address) => `activity:${address.toLowerCase()}`

function read(address: Address): ActivityItem[] {
  const key = storageKey(address)
  let raw: string | null = null
  try {
    raw = localStorage.getItem(key)
  } catch {
    return EMPTY
  }
  const hit = cache.get(key)
  if (hit && hit.raw === raw) return hit.items
  let items = EMPTY
  try {
    items = raw ? (JSON.parse(raw) as ActivityItem[]) : EMPTY
  } catch {
    items = EMPTY
  }
  cache.set(key, { raw, items })
  return items
}

export function recordActivity(address: Address, item: ActivityItem) {
  const items = [item, ...read(address)].slice(0, MAX_ITEMS)
  try {
    localStorage.setItem(storageKey(address), JSON.stringify(items))
  } catch {
    // Storage can be unavailable (private mode); activity just won't persist.
  }
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

export function useActivity(address: Address) {
  const getSnapshot = useCallback(() => read(address), [address])
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY)
}
