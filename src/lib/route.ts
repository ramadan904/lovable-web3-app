import { useSyncExternalStore } from 'react'

// Hash-based routes (#/gas, #/wrapped/vitalik.eth) work on GitHub Pages without server rewrites.
export type Route = {
  view: 'dashboard' | 'gas' | 'wrapped' | 'pay' | 'approvals' | 'watch' | 'prove' | 'verify' | 'tx' | 'view' | 'lock'
  target?: string
  params?: URLSearchParams
}

function parse(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?')
  const [view, ...rest] = path.split('/')
  if (view === 'gas') return { view: 'gas' }
  if (view === 'approvals') return { view: 'approvals' }
  if (view === 'watch') return { view: 'watch' }
  if (view === 'pay' || view === 'verify') return { view, params: new URLSearchParams(query) }
  if (view === 'prove') return { view: 'prove' }
  if (view === 'lock') return { view: 'lock' }
  if (view === 'tx') return { view: 'tx', target: rest[0] || undefined }
  if (view === 'view') return { view: 'view', target: rest.join('/') ? decodeURIComponent(rest.join('/')) : undefined }
  if (view === 'wrapped')
    return { view: 'wrapped', target: rest.join('/') ? decodeURIComponent(rest.join('/')) : undefined }
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
  const hash = route.params
    ? `#/${route.view}?${route.params}`
    : route.view === 'dashboard'
      ? '#/'
      : (route.view === 'wrapped' || route.view === 'tx' || route.view === 'view') && route.target
        ? `#/${route.view}/${encodeURIComponent(route.target)}`
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
