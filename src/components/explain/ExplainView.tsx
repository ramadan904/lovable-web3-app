import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useChains } from 'wagmi'
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CircleCheck,
  CircleX,
  ExternalLink,
  Loader,
  ScrollText,
  TriangleAlert,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { BLOCKSCOUT } from '@/lib/blockscout'
import { explainTx, type BsTxDetail } from '@/lib/explain'
import { formatFiat, nativeUsd, usePrices } from '@/lib/prices'
import { navigate } from '@/lib/route'
import { cn, formatAmount } from '@/lib/utils'
import { fetchWithRetry } from '@/lib/net'

const HASH = /^0x[0-9a-fA-F]{64}$/

/** Looks the hash up on every supported explorer and returns the first match. */
async function findTx(hash: string) {
  const attempts = Object.entries(BLOCKSCOUT).map(async ([chainId, base]) => {
    const res = await fetchWithRetry(`${base}/api/v2/transactions/${hash}`)
    if (!res.ok) throw new Error(String(res.status))
    const tx = (await res.json()) as BsTxDetail
    if (!tx?.hash) throw new Error('not found')
    return { chainId: Number(chainId), tx }
  })
  try {
    return await Promise.any(attempts)
  } catch {
    return null
  }
}

export function ExplainView({ hash }: { hash?: string }) {
  const chains = useChains()
  const prices = usePrices()
  const [input, setInput] = useState(hash ?? '')
  const valid = !!hash && HASH.test(hash)
  const lookup = useQuery({
    queryKey: ['explain', hash?.toLowerCase()],
    enabled: valid,
    staleTime: 60_000,
    queryFn: () => findTx(hash!),
  })

  const found = lookup.data
  const chain = found ? chains.find((c) => c.id === found.chainId) : undefined
  const e = found ? explainTx(found.tx) : undefined
  const price = nativeUsd(prices.data, chain)
  const usd = (eth: number) => (price !== undefined ? ` (${formatFiat(eth * price)})` : '')

  function onSubmit(ev: FormEvent) {
    ev.preventDefault()
    const v = input.trim()
    if (HASH.test(v)) navigate({ view: 'tx', target: v })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display flex items-center gap-2.5 text-3xl tracking-tight sm:text-4xl">
          <ScrollText className="text-primary size-6" /> Transaction explainer
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Paste any transaction hash from Ethereum, Base, Arbitrum, Optimism, Polygon or Sepolia and get it in plain
          English.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={input}
          onChange={(ev) => setInput(ev.target.value.trim())}
          placeholder="0x… (66 characters)"
          className="font-mono"
          spellCheck={false}
          autoComplete="off"
          aria-label="Transaction hash"
          aria-invalid={input !== '' && !HASH.test(input)}
        />
        <Button type="submit" disabled={!HASH.test(input)}>
          Explain
        </Button>
      </form>

      {!hash ? null : !valid ? (
        <p className="text-destructive text-center text-sm">That isn’t a valid transaction hash.</p>
      ) : lookup.isLoading ? (
        <p className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
          <Loader className="size-4 animate-spin" /> Searching every supported network…
        </p>
      ) : !found || !e ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          Couldn’t find that transaction on any supported network. If it was just sent, give it a few seconds.
        </p>
      ) : (
        <Card className="mx-auto w-full max-w-2xl gap-0 overflow-hidden py-0">
          <div
            className={cn(
              'p-6 text-white',
              e.ok ? 'bg-gradient-to-br from-slate-900 to-indigo-800' : 'bg-gradient-to-br from-red-800 to-rose-600',
            )}
          >
            <p className="flex items-center gap-2 text-sm opacity-80">
              {e.ok ? <CircleCheck className="size-4" /> : <CircleX className="size-4" />}
              {e.ok ? 'Succeeded' : 'Failed'} on {chain?.name}
              {found.tx.timestamp && ` · ${new Date(found.tx.timestamp).toLocaleString()}`}
            </p>
            <p className="mt-2 text-2xl leading-snug font-bold break-words">{e.headline}</p>
            {e.failureReason && <p className="mt-2 text-sm opacity-90">Why: {e.failureReason}</p>}
          </div>
          <CardContent className="flex flex-col gap-5 py-5 text-sm">
            {e.warnings.map((w) => (
              <p
                key={w}
                className="flex items-start gap-2 rounded-md bg-amber-500/10 p-3 text-amber-800 dark:text-amber-300"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {w}
              </p>
            ))}

            <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto_1fr] sm:items-center">
              <span className="text-muted-foreground text-xs">From</span>
              <span className="font-mono text-xs break-all">{found.tx.from?.name ?? found.tx.from?.hash}</span>
              <ArrowRight className="text-muted-foreground hidden size-4 sm:block" />
              <span className="font-mono text-xs break-all">
                <span className="text-muted-foreground mr-1 font-sans sm:hidden">To</span>
                {found.tx.to?.name ?? found.tx.to?.hash ?? 'contract creation'}
              </span>
            </div>

            {e.movements.length > 0 && (
              <div>
                <p className="text-muted-foreground mb-2 text-xs">Token movements</p>
                <ul className="divide-y rounded-md border">
                  {e.movements.map((m, i) => (
                    <li key={i} className="flex items-center gap-3 px-3 py-2">
                      {m.direction === 'in' ? (
                        <ArrowDownLeft className="size-4 text-emerald-500" />
                      ) : m.direction === 'out' ? (
                        <ArrowUpRight className="size-4 text-rose-500" />
                      ) : (
                        <ArrowRight className="text-muted-foreground size-4" />
                      )}
                      <span className="font-medium">
                        {m.direction === 'out' ? '−' : m.direction === 'in' ? '+' : ''}
                        {m.amount} {m.symbol}
                      </span>
                      <span className="text-muted-foreground ml-auto truncate text-xs">
                        {m.direction === 'out' ? 'to ' : m.direction === 'in' ? 'from ' : ''}
                        {m.counterparty}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground text-xs">ETH sent</dt>
                <dd className="font-medium">
                  {formatAmount(e.ethValue, 6)} ETH{e.ethValue > 0 ? usd(e.ethValue) : ''}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Network fee</dt>
                <dd className="font-medium">
                  {formatAmount(e.feeEth, 6)} ETH{usd(e.feeEth)}
                </dd>
              </div>
              {e.method && (
                <div>
                  <dt className="text-muted-foreground text-xs">Function</dt>
                  <dd className="font-mono text-xs font-medium">{e.method}</dd>
                </div>
              )}
            </dl>

            {chain?.blockExplorers?.default.url && (
              <a
                href={`${chain.blockExplorers.default.url}/tx/${found.tx.hash}`}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground inline-flex items-center gap-1 text-xs underline underline-offset-4"
              >
                View raw details on the explorer <ExternalLink className="size-3" />
              </a>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
