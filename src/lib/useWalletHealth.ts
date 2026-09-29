import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'

import { useActivity } from '@/lib/activity'
import type { Approval } from '@/lib/approvals'
import { BLOCKSCOUT } from '@/lib/blockscout'
import { useContacts } from '@/lib/contacts'
import { fetchWithRetry, HttpError } from '@/lib/net'
import { detectPoisoning, scoreHealth, type BsTransfer } from '@/lib/poisoning'
import { useHoldings } from '@/lib/useHoldings'

/**
 * Everything behind the wallet health score on one chain: approvals (passed in),
 * address-poisoning attempts and spam tokens. Shared by the Health card and the
 * security report so both show the same numbers from the same cached requests.
 */
export function useWalletHealth(address: Address, chainId: number, approvals: Approval[] | undefined) {
  const contacts = useContacts()
  const history = useActivity(address)
  const holdings = useHoldings(address, chainId)
  const transfers = useQuery({
    queryKey: ['token-transfers', chainId, address.toLowerCase()],
    enabled: !!BLOCKSCOUT[chainId],
    staleTime: 2 * 60_000,
    retry: 1,
    queryFn: async () => {
      const res = await fetchWithRetry(`${BLOCKSCOUT[chainId]}/api/v2/addresses/${address}/token-transfers?type=ERC-20`)
      if (res.status === 404) return [] as BsTransfer[]
      if (!res.ok) throw new HttpError(res, 'Explorer request')
      return ((await res.json()) as { items?: BsTransfer[] }).items ?? []
    },
  })

  const attempts = useMemo(
    () =>
      detectPoisoning(address, transfers.data ?? [], [
        ...contacts.map((c) => c.address),
        ...history.filter((h) => h.chainId === chainId).map((h) => h.to),
      ]),
    [address, transfers.data, contacts, history, chainId],
  )

  const spamTokens = (holdings.data ?? []).filter((h) => h.spam)
  const ready = approvals !== undefined && !transfers.isLoading && !holdings.isLoading
  const health = ready
    ? scoreHealth({
        dangerApprovals: approvals.filter((a) => a.risks.some((r) => r.level === 'danger')).length,
        warningApprovals: approvals.filter(
          (a) => !a.risks.some((r) => r.level === 'danger') && a.risks.some((r) => r.level === 'warning'),
        ).length,
        poisonAttempts: attempts.length,
        spamTokens: spamTokens.length,
      })
    : undefined

  return {
    ready,
    health,
    attempts,
    spamTokens,
    /** Some checks failed to load, so the score may be too kind. */
    partial: transfers.isError || holdings.isError,
  }
}
