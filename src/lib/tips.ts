import { useSyncExternalStore } from 'react'

// Which onboarding tips this browser has dismissed (a per-viewer convenience only).
const KEY = 'tips-dismissed'
const listeners = new Set<() => void>()
let dismissed: string[] = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    return Array.isArray(saved) ? saved.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
})()

function save(next: string[]) {
  dismissed = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // storage blocked: tips just come back next visit
  }
  listeners.forEach((l) => l())
}

export const dismissTip = (id: string) => save([...new Set([...dismissed, id])])
export const resetTips = () => save([])

export function useTipDismissed(id: string) {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => dismissed.includes(id),
  )
}

export function useAnyTipDismissed() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => dismissed.length > 0,
  )
}
