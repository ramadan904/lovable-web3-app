import { useQuery } from '@tanstack/react-query'

import { computeWrapped, type BsTx, type Counters } from '@/lib/wrapped'

// Free public explorer APIs (no key needed).
export const BLOCKSCOUT: Record<number, string> = {
  1: 'https://eth.blockscout.com',
  8453: 'https://base.blockscout.com',
  11155111: 'https://eth-sepolia.blockscout.com',
}

type Page = { items?: BsTx[]; next_page_params?: Record<string, string | number> | null }

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (res.status === 404) return {} as T // address never seen on this chain
  if (!res.ok) throw new Error(`Explorer request failed (${res.status})`)
  return res.json() as Promise<T>
}

async function recentTransactions(base: string, address: string, pages = 2) {
  const items: BsTx[] = []
  let params: Record<string, string | number> | null | undefined = undefined
  for (let i = 0; i < pages; i++) {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}` : ''
    const page: Page = await get<Page>(`${base}/api/v2/addresses/${address}/transactions${qs}`)
    items.push(...(page.items ?? []))
    params = page.next_page_params
    if (!params) break
  }
  return { items, complete: !params }
}

/** Try to fetch the very first transaction; returns undefined if the explorer can't sort ascending. */
async function oldestTransaction(base: string, address: string) {
  try {
    const page = await get<Page>(`${base}/api/v2/addresses/${address}/transactions?sort=block_number&order=asc`)
    const items = page.items ?? []
    if (items.length < 2) return items[0]
    const first = Date.parse(items[0].timestamp)
    const last = Date.parse(items[items.length - 1].timestamp)
    return first <= last ? items[0] : undefined
  } catch {
    return undefined
  }
}

export function useWrapped(address: string | undefined, chainId: number) {
  return useQuery({
    queryKey: ['wrapped', chainId, address?.toLowerCase()],
    enabled: !!address && !!BLOCKSCOUT[chainId],
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async () => {
      const base = BLOCKSCOUT[chainId]
      const [counters, recent, oldest] = await Promise.all([
        get<Counters>(`${base}/api/v2/addresses/${address}/counters`),
        recentTransactions(base, address!),
        oldestTransaction(base, address!),
      ])
      return computeWrapped(address!, counters, recent.items, recent.complete ? undefined : oldest)
    },
  })
}
