import { useSyncExternalStore } from 'react'

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

// Chromium fires this once, possibly before React mounts, so capture it at module load.
let deferred: InstallPrompt | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e as InstallPrompt
  emit()
})
window.addEventListener('appinstalled', () => {
  deferred = null
  emit()
})

export async function promptInstall() {
  if (!deferred) return
  await deferred.prompt()
  await deferred.userChoice
  deferred = null
  emit()
}

/** True when the browser offers an install prompt for this app. */
export function useCanInstall() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => deferred !== null,
  )
}
