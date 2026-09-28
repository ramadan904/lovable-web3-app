import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const KEY = 'theme'
const listeners = new Set<() => void>()

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // ignore
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

let theme: Theme = initialTheme()
document.documentElement.classList.toggle('dark', theme === 'dark')

export function setTheme(next: Theme) {
  theme = next
  document.documentElement.classList.toggle('dark', next === 'dark')
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // ignore
  }
  listeners.forEach((l) => l())
}

export function useTheme() {
  const value = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => theme,
  )
  return { theme: value, toggle: () => setTheme(value === 'dark' ? 'light' : 'dark') }
}
