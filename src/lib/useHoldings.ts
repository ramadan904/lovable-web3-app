import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'

import { BLOCKSCOUT } from '@/lib/blockscout'
import { toHoldings, type BsTokenBalance } from '@/lib/holdings'
import { fetchWithRetry, HttpError } from '@/lib/net'

/** Every ERC-20 the address holds on `chainId` (cached per chain + address). */
export function useHoldings(address: Address, chainId: number) {
  return useQuery({
    queryKey: ['holdings', chainId, address.toLowerCase()],
    enabled: !!BLOCKSCOUT[chainId],
    staleTime: 60_000,
    retry: 1,
    queryFn: async () => {
      const res = await fetchWithRetry(`${BLOCKSCOUT[chainId]}/api/v2/addresses/${address}/token-balances`)
      if (res.status === 404) return []
      if (!res.ok) throw new HttpError(res, 'Explorer request')
      const body = (await res.json()) as BsTokenBalance[] | { items?: BsTokenBalance[] }
      return toHoldings(chainId, Array.isArray(body) ? body : (body.items ?? []))
    },
  })
}
