import { useEffect, useState } from 'react'
import { erc20Abi, formatUnits, type Hash } from 'viem'
import { useChains, useConnection, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import {
  ExternalLink,
  Info,
  Loader,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldHalf,
  TriangleAlert,
} from 'lucide-react'

import { HealthCard } from '@/components/approvals/HealthCard'
import { RevokeAll } from '@/components/approvals/RevokeAll'
import { ConnectCard } from '@/components/ConnectCard'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { LoadError, StaleNote } from '@/components/LoadError'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { nftAbi, useApprovals, type Approval } from '@/lib/approvals'
import { BLOCKSCOUT } from '@/lib/blockscout'
import { cn, formatAmount, shortenAddress } from '@/lib/utils'
import type { ChainId } from '@/lib/wagmi'

const RISK_ICON = { danger: ShieldAlert, warning: TriangleAlert, info: Info }
const RISK_CLASS = {
  danger: 'text-red-700 dark:text-red-400',
  warning: 'text-amber-700 dark:text-amber-400',
  info: 'text-muted-foreground',
}

function amountText(a: Approval) {
  if (a.kind === 'nft') return 'All items'
  if (a.unlimited) return 'Unlimited'
  return formatAmount(Number(formatUnits(a.allowance ?? 0n, a.decimals ?? 18)))
}

function Row({ a, chainId, explorer }: { a: Approval; chainId: ChainId; explorer?: string }) {
  const { chain } = useConnection()
  const switchChain = useSwitchChain()
  const write = useWriteContract()
  const queryClient = useQueryClient()
  const [hash, setHash] = useState<Hash>()
  const receipt = useWaitForTransactionReceipt({ hash, chainId })
  const revoked = receipt.data?.status === 'success'
  const danger = a.risks.some((r) => r.level === 'danger')
  // Give the explorer/RPC a moment to see the revoke, then rescan.
  useEffect(() => {
    if (!revoked) return
    const t = setTimeout(() => queryClient.invalidateQueries({ queryKey: ['approvals'] }), 4000)
    return () => clearTimeout(t)
  }, [revoked, queryClient])

  function revoke() {
    const onSuccess = (h: Hash) => setHash(h)
    if (a.kind === 'nft')
      write.mutate(
        { address: a.token, abi: nftAbi, functionName: 'setApprovalForAll', args: [a.spender, false], chainId },
        { onSuccess },
      )
    else
      write.mutate(
        { address: a.token, abi: erc20Abi, functionName: 'approve', args: [a.spender, 0n], chainId },
        { onSuccess },
      )
  }

  return (
    <li className={cn('flex flex-col gap-3 py-4 sm:flex-row sm:items-start', revoked && 'opacity-50')}>
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {a.tokenLabel}
          <span className="bg-muted text-muted-foreground ml-2 rounded px-1.5 py-0.5 text-xs font-normal">
            {a.kind === 'nft' ? 'NFT collection' : 'token'}
          </span>
        </p>
        <p className="text-muted-foreground text-sm">
          <span className={cn('font-semibold', a.unlimited ? 'text-foreground' : '')}>{amountText(a)}</span> →{' '}
          {explorer ? (
            <a
              href={`${explorer}/address/${a.spender}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-4"
            >
              {a.spenderLabel ?? shortenAddress(a.spender)}
              <ExternalLink className="size-3" />
            </a>
          ) : (
            (a.spenderLabel ?? shortenAddress(a.spender))
          )}
          {a.lastSeen && <span> · since {a.lastSeen.toLocaleDateString()}</span>}
        </p>
        {a.risks.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1">
            {a.risks.map((r) => {
              const Icon = RISK_ICON[r.level]
              return (
                <li key={r.text} className={cn('flex items-start gap-1.5 text-xs', RISK_CLASS[r.level])}>
                  <Icon className="mt-px size-3.5 shrink-0" /> {r.text}
                </li>
              )
            })}
          </ul>
        )}
        {receipt.isError && <p className="text-destructive mt-2 text-xs">The revoke transaction failed on-chain.</p>}
        {write.error && (
          <p className="text-destructive mt-2 text-xs">
            {'shortMessage' in write.error ? String(write.error.shortMessage) : write.error.message}
          </p>
        )}
      </div>
      <div className="shrink-0">
        {revoked ? (
          <span className="flex items-center gap-1 text-sm font-medium text-emerald-600">
            <ShieldCheck className="size-4" /> Revoked
          </span>
        ) : chain?.id !== chainId ? (
          <Button size="sm" variant="outline" onClick={() => switchChain.mutate({ chainId })}>
            Switch to revoke
          </Button>
        ) : (
          <Button
            size="sm"
            variant={danger ? 'destructive' : 'outline'}
            onClick={revoke}
            disabled={write.isPending || (!!hash && receipt.isLoading)}
          >
            {write.isPending
              ? 'Confirm in wallet…'
              : hash && receipt.isLoading
                ? 'Revoking…'
                : receipt.isError
                  ? 'Retry revoke'
                  : 'Revoke'}
          </Button>
        )}
      </div>
    </li>
  )
}

export function ApprovalsView() {
  const { address, status } = useConnection()
  const chains = useChains()
  const [chainId, setChainId] = useState<ChainId>(chains[0].id)
  const scan = useApprovals(address, chainId)
  const chain = chains.find((c) => c.id === chainId)
  const explorer = chain?.blockExplorers?.default.url

  const approvals = scan.data?.approvals ?? []
  const riskyList = approvals.filter((a) => a.risks.some((r) => r.level !== 'info'))
  const risky = riskyList.length

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ShieldHalf className="text-primary size-6" /> Wallet Guard
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          A security check-up: health score, address-poisoning detector, and every app allowed to spend your tokens —
          with one-click revoke.
        </p>
      </div>

      {status !== 'connected' || !address ? (
        <div className="flex justify-center">
          <ConnectCard />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {chains
              .filter((c) => BLOCKSCOUT[c.id])
              .map((c) => (
                <Button
                  key={c.id}
                  size="sm"
                  variant={c.id === chainId ? 'default' : 'outline'}
                  onClick={() => setChainId(c.id)}
                >
                  {c.name}
                </Button>
              ))}
            <Button
              size="icon"
              variant="ghost"
              aria-label="Rescan"
              onClick={() => scan.refetch()}
              className="ml-auto"
              disabled={scan.isFetching}
            >
              <RefreshCw className={scan.isFetching ? 'animate-spin' : undefined} />
            </Button>
          </div>

          <ErrorBoundary label="Wallet health">
            <HealthCard address={address} chainId={chainId} chainName={chain?.name} approvals={scan.data?.approvals} />
          </ErrorBoundary>
          <Card>
            <CardContent>
              {scan.isError && scan.data && <StaleNote updatedAt={scan.dataUpdatedAt} onRetry={() => scan.refetch()} />}
              {scan.isLoading ? (
                <p className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
                  <Loader className="size-4 animate-spin" /> Scanning your approval history on {chain?.name}…
                </p>
              ) : scan.isError && !scan.data ? (
                <LoadError
                  what="your approval history"
                  source={`the ${chain?.name ?? ''} explorer`}
                  onRetry={() => scan.refetch()}
                  retrying={scan.isFetching}
                />
              ) : approvals.length === 0 ? (
                <p className="flex flex-col items-center gap-2 py-10 text-center text-sm">
                  <ShieldCheck className="size-8 text-emerald-600" />
                  <span className="font-medium">No active approvals on {chain?.name}.</span>
                  <span className="text-muted-foreground">Nothing can spend your tokens without asking you first.</span>
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-4">
                    <p className="text-lg font-semibold">
                      {approvals.length} active approval{approvals.length === 1 ? '' : 's'}
                    </p>
                    <p
                      className={cn(
                        'text-sm font-medium',
                        risky ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-600',
                      )}
                    >
                      {risky ? `${risky} need${risky === 1 ? 's' : ''} attention` : 'All look fine'}
                    </p>
                  </div>
                  <div className="pt-4">
                    <RevokeAll approvals={riskyList} chainId={chainId} />
                  </div>
                  <ul className="divide-y">
                    {approvals.map((a) => (
                      <Row key={`${a.kind}:${a.token}:${a.spender}`} a={a} chainId={chainId} explorer={explorer} />
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>
          {scan.data?.method === 'holdings' && (
            <p className="text-muted-foreground text-xs">
              Full history search was unavailable, so this checked the tokens you hold against contracts you’ve used.
              Some older approvals may be missing.
            </p>
          )}
        </>
      )}
    </div>
  )
}
