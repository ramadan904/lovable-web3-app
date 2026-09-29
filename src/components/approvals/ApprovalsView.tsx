import { useEffect, useState } from 'react'
import { encodeFunctionData, erc20Abi, formatUnits, isAddress, type Address, type Hash } from 'viem'
import { normalize } from 'viem/ens'
import {
  useChains,
  useConnection,
  useEnsAddress,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { useQueryClient } from '@tanstack/react-query'
import {
  ExternalLink,
  Eye,
  Info,
  Loader,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldHalf,
  TriangleAlert,
} from 'lucide-react'

import { ExportReport } from '@/components/approvals/ExportReport'
import { HealthCard } from '@/components/approvals/HealthCard'
import { RevokeAll } from '@/components/approvals/RevokeAll'
import { ConnectCard } from '@/components/ConnectCard'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { LoadError, StaleNote } from '@/components/LoadError'
import { OnboardingTip } from '@/components/OnboardingTip'
import { ReviewDialog } from '@/components/review/ReviewDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { nftAbi, useApprovals, type Approval } from '@/lib/approvals'
import { BLOCKSCOUT } from '@/lib/blockscout'
import { navigate } from '@/lib/route'
import { cn, formatAmount, shortenAddress } from '@/lib/utils'
import type { ChainId } from '@/lib/wagmi'
import { chainLabel } from '@/lib/chains'

function safeNormalize(name: string) {
  try {
    return normalize(name)
  } catch {
    return undefined
  }
}

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

function Row({
  a,
  chainId,
  explorer,
  readOnly,
}: {
  a: Approval
  chainId: ChainId
  explorer?: string
  /** Scanning someone else's wallet: show, don't offer to revoke. */
  readOnly: boolean
}) {
  const { address, chain } = useConnection()
  const switchChain = useSwitchChain()
  const write = useWriteContract()
  const [reviewing, setReviewing] = useState(false)
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

  const revokeData =
    a.kind === 'nft'
      ? encodeFunctionData({ abi: nftAbi, functionName: 'setApprovalForAll', args: [a.spender, false] })
      : encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [a.spender, 0n] })

  function revoke() {
    const onSuccess = (h: Hash) => {
      setReviewing(false)
      setHash(h)
    }
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
        {readOnly ? null : revoked ? (
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
            onClick={() => setReviewing(true)}
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
      {address && (
        <ReviewDialog
          open={reviewing}
          onClose={() => setReviewing(false)}
          onConfirm={revoke}
          title="Review revoke"
          summary={
            <p>
              Revoke <b>{a.spenderLabel ?? shortenAddress(a.spender)}</b>’s access to your <b>{a.tokenLabel}</b>
            </p>
          }
          chainId={chainId}
          account={address}
          calls={[{ to: a.token, data: revokeData }]}
          confirmLabel="Revoke in wallet"
          pending={write.isPending}
          error={
            write.error
              ? 'shortMessage' in write.error
                ? String(write.error.shortMessage)
                : write.error.message
              : undefined
          }
        />
      )}
    </li>
  )
}

export function ApprovalsView({ target }: { target?: string }) {
  const { address: connected } = useConnection()
  const chains = useChains()
  const [chainId, setChainId] = useState<ChainId>(chains[0].id)
  const [input, setInput] = useState(target ?? '')

  // Whose wallet: the route target (address or ENS name), else the connected wallet.
  const query = target ?? connected ?? ''
  const ensName = !isAddress(query) && query.includes('.') ? safeNormalize(query) : undefined
  const ens = useEnsAddress({ name: ensName, chainId: mainnet.id, query: { enabled: !!ensName } })
  const address: Address | undefined = isAddress(query) ? query : (ens.data ?? undefined)
  const readOnly = !connected || !address || address.toLowerCase() !== connected.toLowerCase()
  const label = ensName ?? (address ? shortenAddress(address) : '')

  const scan = useApprovals(address, chainId)
  const chain = chains.find((c) => c.id === chainId)
  const explorer = chain?.blockExplorers?.default.url

  const approvals = scan.data?.approvals ?? []
  const riskyList = approvals.filter((a) => a.risks.some((r) => r.level !== 'info'))
  const risky = riskyList.length

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display flex items-center gap-2.5 text-3xl tracking-tight sm:text-4xl">
          <ShieldHalf className="text-primary size-6" /> Wallet Guard
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          A security check-up: health score, address-poisoning detector, and every app allowed to spend your tokens —
          with one-click revoke.
        </p>
      </div>
      <OnboardingTip id="approval-guard" title="What are approvals, and why revoke them?">
        <p>
          When you use an app like Uniswap or OpenSea, you give it permission to move your tokens. Those permissions
          never expire on their own — and old, unlimited or unknown ones are exactly how wallet drainers empty wallets.
        </p>
        <p>
          Revoking one costs a small network fee, never moves your funds, and you’ll see a simulation first. When in
          doubt, revoke — the app will simply ask again next time you use it.
        </p>
      </OnboardingTip>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          const v = input.trim()
          if (v) navigate({ view: 'approvals', target: v })
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            connected ? `${shortenAddress(connected)} (you) — or any address / name.eth` : 'Any address or name.eth'
          }
          className="font-mono"
          spellCheck={false}
          autoComplete="off"
          aria-label="Wallet to check"
        />
        <Button type="submit">Check wallet</Button>
      </form>

      {!query ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed p-8 text-center">
          <ShieldHalf className="text-muted-foreground size-8" aria-hidden />
          <p className="max-w-md text-sm">
            Enter any address to see its approvals and health score — read-only, nothing to sign. Or{' '}
            <button
              type="button"
              className="font-medium underline underline-offset-4"
              onClick={() => navigate({ view: 'approvals', target: 'vitalik.eth' })}
            >
              check vitalik.eth
            </button>
            .
          </p>
          <ConnectCard />
        </div>
      ) : ensName && ens.isLoading ? (
        <div className="skeleton h-40 rounded-xl" role="status" aria-label={`Looking up ${ensName}`} />
      ) : !address ? (
        <p className="text-destructive rounded-xl border border-dashed p-8 text-center text-sm">
          Couldn’t find a wallet for “{query}”.
        </p>
      ) : (
        <>
          {readOnly && (
            <p className="bg-muted/60 flex flex-wrap items-center gap-x-2 rounded-lg px-3 py-2 text-xs">
              <Eye className="size-3.5" aria-hidden /> Viewing <b className="font-mono">{label}</b> read-only.
              {connected ? (
                <button
                  className="underline underline-offset-4"
                  onClick={() => navigate({ view: 'approvals', target: connected })}
                >
                  Check your own wallet
                </button>
              ) : (
                'Connect the wallet to revoke anything.'
              )}
            </p>
          )}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="chip-row min-w-0 flex-1">
              {chains
                .filter((c) => BLOCKSCOUT[c.id])
                .map((c) => (
                  <Button
                    key={c.id}
                    size="sm"
                    variant={c.id === chainId ? 'default' : 'outline'}
                    onClick={() => setChainId(c.id)}
                  >
                    {chainLabel(c)}
                  </Button>
                ))}
            </div>
            <div className="flex items-center gap-1 self-end lg:self-auto">
              <ExportReport
                address={address}
                chainId={chainId}
                chainName={chain?.name ?? `Chain ${chainId}`}
                explorer={explorer}
                approvals={scan.data?.approvals}
                approvalsFromHoldings={scan.data?.method === 'holdings'}
              />
              <Button
                size="icon"
                variant="ghost"
                aria-label="Rescan"
                onClick={() => scan.refetch()}
                disabled={scan.isFetching}
              >
                <RefreshCw className={scan.isFetching ? 'animate-spin' : undefined} />
              </Button>
            </div>
          </div>

          <ErrorBoundary label="Wallet health">
            <HealthCard address={address} chainId={chainId} chainName={chain?.name} approvals={scan.data?.approvals} />
          </ErrorBoundary>
          <Card>
            <CardContent>
              {scan.isError && scan.data && <StaleNote updatedAt={scan.dataUpdatedAt} onRetry={() => scan.refetch()} />}
              {scan.isLoading ? (
                <div role="status" className="flex flex-col gap-4 py-2">
                  <p className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Loader className="size-4 animate-spin" /> Reading every approval {readOnly ? label : 'you'} ever
                    granted on {chain?.name}, then checking which are still live…
                  </p>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-start gap-4 border-t pt-4" aria-hidden>
                      <div className="flex flex-1 flex-col gap-2">
                        <span className="skeleton h-4 w-28 rounded" />
                        <span className="skeleton h-3 w-56 max-w-full rounded" />
                        <span className="skeleton h-3 w-40 rounded" />
                      </div>
                      <span className="skeleton h-8 w-20 rounded-md" />
                    </div>
                  ))}
                </div>
              ) : scan.isError && !scan.data ? (
                <LoadError
                  what={readOnly ? `${label}’s approval history` : 'your approval history'}
                  source={`the ${chain?.name ?? ''} explorer`}
                  onRetry={() => scan.refetch()}
                  retrying={scan.isFetching}
                />
              ) : approvals.length === 0 ? (
                <p className="flex flex-col items-center gap-2 py-10 text-center text-sm">
                  <ShieldCheck className="size-8 text-emerald-600" />
                  <span className="font-medium">No active approvals on {chain?.name}.</span>
                  <span className="text-muted-foreground">
                    Nothing can spend {readOnly ? 'this wallet’s' : 'your'} tokens without asking first.
                  </span>
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
                  {!readOnly && (
                    <div className="pt-4">
                      <RevokeAll approvals={riskyList} chainId={chainId} />
                    </div>
                  )}
                  <ul className="divide-y">
                    {approvals.map((a) => (
                      <Row
                        key={`${a.kind}:${a.token}:${a.spender}`}
                        a={a}
                        chainId={chainId}
                        explorer={explorer}
                        readOnly={readOnly}
                      />
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
