import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { encodeFunctionData, erc20Abi } from 'viem'
import { useCapabilities, useConnection, useSendCalls, useWaitForCallsStatus } from 'wagmi'
import { Layers, ShieldCheck } from 'lucide-react'

import { ReviewDialog } from '@/components/review/ReviewDialog'
import { Button } from '@/components/ui/button'
import { nftAbi, type Approval } from '@/lib/approvals'
import type { ChainId } from '@/lib/wagmi'
import { celebrate } from '@/lib/celebrate'

/**
 * EIP-5792: wallets that support atomic batches (smart wallets, EIP-7702 accounts)
 * can revoke every risky approval with a single confirmation.
 */
export function RevokeAll({ approvals, chainId }: { approvals: Approval[]; chainId: ChainId }) {
  const { address, chain } = useConnection()
  const [reviewing, setReviewing] = useState(false)
  const queryClient = useQueryClient()
  const onChain = chain?.id === chainId
  const caps = useCapabilities({ chainId, query: { enabled: onChain, retry: false } })
  const atomic = (caps.data as { atomic?: { status?: string } } | undefined)?.atomic?.status
  const canBatch = atomic === 'supported' || atomic === 'ready'

  const send = useSendCalls()
  const status = useWaitForCallsStatus({ id: send.data?.id, query: { enabled: !!send.data?.id } })
  const done = status.data?.status === 'success'
  const failed = status.data?.status === 'failure' || status.isError

  useEffect(() => {
    if (!done) return
    celebrate('big')
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

  const calls = approvals.map((a) => ({
    to: a.token,
    data:
      a.kind === 'nft'
        ? encodeFunctionData({ abi: nftAbi, functionName: 'setApprovalForAll', args: [a.spender, false] })
        : encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [a.spender, 0n] }),
  }))

  function revokeAll() {
    send.mutate({ chainId, calls }, { onSuccess: () => setReviewing(false) })
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
      {done ? (
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-600">
          <ShieldCheck className="size-4" /> All {approvals.length} revoked in one go. Rescanning…
        </p>
      ) : (
        <Button
          variant="destructive"
          onClick={() => setReviewing(true)}
          disabled={send.isPending || (!!send.data && !done && !failed)}
        >
          <Layers />
          {send.isPending
            ? 'Confirm in your wallet…'
            : send.data && !failed
              ? 'Revoking…'
              : `Revoke all ${approvals.length} risky approvals — one signature`}
        </Button>
      )}
      {address && (
        <ReviewDialog
          open={reviewing}
          onClose={() => setReviewing(false)}
          onConfirm={revokeAll}
          title="Review batch revoke"
          summary={
            <p>
              Revoke <b>{approvals.length} risky approvals</b> with one signature
            </p>
          }
          chainId={chainId}
          account={address}
          calls={calls}
          confirmLabel="Revoke all in wallet"
          pending={send.isPending}
          error={
            send.error
              ? 'shortMessage' in send.error
                ? String(send.error.shortMessage)
                : send.error.message
              : undefined
          }
        />
      )}
      {failed && (
        <p className="text-destructive text-xs">
          The batch failed on-chain — nothing was revoked. Try again or revoke one by one.
        </p>
      )}
      {send.error && (
        <p className="text-destructive text-xs">
          {'shortMessage' in send.error ? String(send.error.shortMessage) : send.error.message}
        </p>
      )}
    </div>
  )
}
