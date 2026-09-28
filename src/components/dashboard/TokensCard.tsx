import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { useChains } from 'wagmi'
import { ChevronDown, EyeOff, ShieldAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BLOCKSCOUT } from '@/lib/blockscout'
import { toHoldings, type BsTokenBalance, type Holding } from '@/lib/holdings'
import { formatUsd } from '@/lib/prices'
import { cn, formatAmount, shortenAddress } from '@/lib/utils'

function useHoldings(address: Address, chainId: number) {
  return useQuery({
    queryKey: ['holdings', chainId, address.toLowerCase()],
    enabled: !!BLOCKSCOUT[chainId],
    staleTime: 60_000,
    retry: 1,
    queryFn: async () => {
      const res = await fetch(`${BLOCKSCOUT[chainId]}/api/v2/addresses/${address}/token-balances`)
      if (res.status === 404) return []
      if (!res.ok) throw new Error(`Explorer error ${res.status}`)
      const body = (await res.json()) as BsTokenBalance[] | { items?: BsTokenBalance[] }
      return toHoldings(chainId, Array.isArray(body) ? body : (body.items ?? []))
    },
  })
}

function TokenIcon({ h }: { h: Holding }) {
  const [broken, setBroken] = useState(false)
  if (h.icon && !broken)
    return <img src={h.icon} alt="" className="size-8 rounded-full" onError={() => setBroken(true)} loading="lazy" />
  return (
    <span className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-full text-xs font-semibold">
      {h.symbol.slice(0, 3)}
    </span>
  )
}

function Row({ h, explorer }: { h: Holding; explorer?: string }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <TokenIcon h={h} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{h.spam ? shortenAddress(h.address) : h.name}</p>
        <p className="text-muted-foreground truncate text-xs">
          {h.spam ? (
            <span className="text-red-700 dark:text-red-400">{h.spam}</span>
          ) : explorer ? (
            <a href={`${explorer}/token/${h.address}`} target="_blank" rel="noreferrer" className="hover:underline">
              {h.symbol}
            </a>
          ) : (
            h.symbol
          )}
        </p>
      </div>
      <div className="text-right tabular-nums">
        <p className="text-sm">{h.spam ? '—' : formatAmount(h.amount)}</p>
        {h.usd !== undefined && <p className="text-muted-foreground text-xs">{formatUsd(h.usd)}</p>}
      </div>
    </li>
  )
}

export function TokensCard({ address }: { address: Address }) {
  const chains = useChains()
  const [chainId, setChainId] = useState<number>(chains[1]?.id ?? chains[0].id)
  const [showSpam, setShowSpam] = useState(false)
  const holdings = useHoldings(address, chainId)
  const chain = chains.find((c) => c.id === chainId)
  const explorer = chain?.blockExplorers?.default.url

  const all = holdings.data ?? []
  const real = all.filter((h) => !h.spam)
  const spam = all.filter((h) => h.spam)
  const total = real.reduce((s, h) => s + (h.usd ?? 0), 0)

  return (
    <Card className="md:col-span-2">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1.5">
          <CardTitle>Tokens</CardTitle>
          <CardDescription>
            Everything this wallet holds on {chain?.name}
            {real.some((h) => h.usd !== undefined) && !chain?.testnet ? ` · ${formatUsd(total)}` : ''}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {chains
            .filter((c) => BLOCKSCOUT[c.id])
            .map((c) => (
              <Button
                key={c.id}
                size="sm"
                variant={c.id === chainId ? 'default' : 'outline'}
                onClick={() => {
                  setChainId(c.id)
                  setShowSpam(false)
                }}
              >
                {c.name}
              </Button>
            ))}
        </div>
      </CardHeader>
      <CardContent>
        {holdings.isLoading ? (
          <p className="text-muted-foreground py-6 text-center text-sm">Loading tokens…</p>
        ) : holdings.isError ? (
          <p className="text-destructive py-6 text-center text-sm">Couldn’t load tokens from the explorer right now.</p>
        ) : all.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">No tokens on {chain?.name}.</p>
        ) : (
          <>
            {real.length > 0 ? (
              <ul className="divide-y">
                {real.map((h) => (
                  <Row key={h.address} h={h} explorer={explorer} />
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground py-4 text-center text-sm">Only spam here.</p>
            )}
            {spam.length > 0 && (
              <div className="mt-2 border-t pt-3">
                <button
                  onClick={() => setShowSpam((v) => !v)}
                  className="text-muted-foreground flex w-full items-center gap-2 text-sm"
                  aria-expanded={showSpam}
                >
                  <EyeOff className="size-4" />
                  {spam.length} scam / spam token{spam.length === 1 ? '' : 's'} hidden
                  <ChevronDown className={cn('ml-auto size-4 transition-transform', showSpam && 'rotate-180')} />
                </button>
                {showSpam && (
                  <>
                    <p className="mt-2 flex items-start gap-2 rounded-md bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-400">
                      <ShieldAlert className="mt-px size-4 shrink-0" />
                      Don’t interact with these or visit sites named in them — they’re bait for wallet-draining scams.
                    </p>
                    <ul className="divide-y opacity-80">
                      {spam.map((h) => (
                        <Row key={h.address} h={h} />
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
