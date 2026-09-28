import { useSyncExternalStore } from 'react'
import { getAddress, type Address } from 'viem'

export type Watched = { address: Address; label: string }

const KEY = 'watchlist'
export const MAX_WATCHED = 10
const listeners = new Set<() => void>()

function load(): Watched[] {
  try {
    const raw = localStorage.getItem(KEY)
    const items = raw ? (JSON.parse(raw) as Watched[]) : []
    return Array.isArray(items) ? items : []
  } catch {
    return []
  }
}

let list = load()

function save(next: Watched[]) {
  list = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // storage unavailable: the list lasts for this visit only
  }
  listeners.forEach((l) => l())
}

export function addWatched(address: Address, label: string) {
  const a = getAddress(address)
  if (list.some((w) => w.address === a) || list.length >= MAX_WATCHED) return false
  save([...list, { address: a, label }])
  return true
}

export function removeWatched(address: Address) {
  save(list.filter((w) => w.address !== address))
}

export function useWatchlist() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => list,
  )
}
