import { useSyncExternalStore } from 'react'

// Hash-based routes (#/gas, #/wrapped/vitalik.eth) work on GitHub Pages without server rewrites.
export type Route = {
  view: 'dashboard' | 'gas' | 'wrapped' | 'pay' | 'approvals'
  target?: string
  params?: URLSearchParams
}

function parse(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?')
  const [view, ...rest] = path.split('/')
  if (view === 'gas') return { view: 'gas' }
  if (view === 'approvals') return { view: 'approvals' }
  if (view === 'pay') return { view: 'pay', params: new URLSearchParams(query) }
  if (view === 'wrapped') return { view: 'wrapped', target: rest.join('/') ? decodeURIComponent(rest.join('/')) : undefined }
  return { view: 'dashboard' }
}

let current = parse(window.location.hash)
const listeners = new Set<() => void>()
window.addEventListener('hashchange', () => {
  current = parse(window.location.hash)
  listeners.forEach((l) => l())
  window.scrollTo({ top: 0 })
})

export function navigate(route: Route) {
  const hash =
    route.view === 'pay' && route.params
      ? `#/pay?${route.params}`
      : route.view === 'dashboard'
      ? '#/'
      : route.view === 'wrapped' && route.target
        ? `#/wrapped/${encodeURIComponent(route.target)}`
        : `#/${route.view}`
  if (window.location.hash !== hash) window.location.hash = hash
}

export function useRoute() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
}
