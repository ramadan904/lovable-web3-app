import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { encodeFunctionData, erc20Abi } from 'viem'
import { useCapabilities, useConnection, useSendCalls, useWaitForCallsStatus } from 'wagmi'
import { Layers, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { nftAbi, type Approval } from '@/lib/approvals'
import type { ChainId } from '@/lib/wagmi'

/**
 * EIP-5792: wallets that support atomic batches (smart wallets, EIP-7702 accounts)
 * can revoke every risky approval with a single confirmation.
 */
export function RevokeAll({ approvals, chainId }: { approvals: Approval[]; chainId: ChainId }) {
  const { chain } = useConnection()
  const queryClient = useQueryClient()
  const onChain = chain?.id === chainId
  const caps = useCapabilities({ chainId, query: { enabled: onChain, retry: false } })
  const atomic = (caps.data as { atomic?: { status?: string } } | undefined)?.atomic?.status
  const canBatch = atomic === 'supported' || atomic === 'ready'

  const send = useSendCalls()
  const status = useWaitForCallsStatus({ id: send.data?.id, query: { enabled: !!send.data?.id } })
  const done = status.data?.status === 'success'

  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => queryClient.invalidateQueries({ queryKey: ['approvals'] }), 4000)
    return () => clearTimeout(t)
  }, [done, queryClient])

  if (approvals.length < 2 || !onChain || caps.isLoading) return null

  if (!canBatch)
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-xs">
        <Layers className="size-4 shrink-0" />
        Your wallet can’t batch transactions, so revoke these one by one. Smart wallets (like Coinbase Smart Wallet) can
        revoke them all with a single confirmation.
      </p>
    )

  function revokeAll() {
    send.mutate({
      chainId,
      calls: approvals.map((a) => ({
        to: a.token,
        data:
          a.kind === 'nft'
            ? encodeFunctionData({ abi: nftAbi, functionName: 'setApprovalForAll', args: [a.spender, false] })
            : encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [a.spender, 0n] }),
      })),
    })
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
      {done ? (
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-600">
          <ShieldCheck className="size-4" /> All {approvals.length} revoked in one go. Rescanning…
        </p>
      ) : (
        <Button variant="destructive" onClick={revokeAll} disabled={send.isPending || (!!send.data && !done)}>
          <Layers />
          {send.isPending
            ? 'Confirm in your wallet…'
            : send.data
              ? 'Revoking…'
              : `Revoke all ${approvals.length} risky approvals — one signature`}
        </Button>
      )}
      {send.error && (
        <p className="text-destructive text-xs">
          {'shortMessage' in send.error ? String(send.error.shortMessage) : send.error.message}
        </p>
      )}
    </div>
  )
}
