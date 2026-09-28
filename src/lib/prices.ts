import { useQuery } from '@tanstack/react-query'

export type Prices = { eth: number; usdc: number }

/** USD prices from CoinGecko's free public API; undefined if unavailable. */
export function usePrices() {
  return useQuery({
    queryKey: ['prices'],
    queryFn: async (): Promise<Prices> => {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,usd-coin&vs_currencies=usd',
      )
      if (!res.ok) throw new Error(`Price request failed: ${res.status}`)
      const data = (await res.json()) as Record<string, { usd?: number }>
      const eth = data.ethereum?.usd
      if (typeof eth !== 'number') throw new Error('Price missing from response')
      return { eth, usdc: data['usd-coin']?.usd ?? 1 }
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
  })
}

export function formatUsd(value: number) {
  return value.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}
