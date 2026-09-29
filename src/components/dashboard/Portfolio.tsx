import type { Address } from 'viem'
import { useChains } from 'wagmi'
import { RefreshCw, WifiOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toEth, toUsdc, useBalances } from '@/lib/balances'
import { formatFiat, nativeUsd, usePrices } from '@/lib/prices'
import { formatAmount } from '@/lib/utils'

function Cell({ amount, usd, loading, unit }: { amount?: number; usd?: number; loading: boolean; unit?: string }) {
  if (amount === undefined) return <span className="text-muted-foreground">{loading ? '…' : '—'}</span>
  return (
    <div className="flex flex-col items-end">
      <span>
        {formatAmount(amount)}
        {unit && <span className="text-muted-foreground ml-1 text-xs">{unit}</span>}
      </span>
      {usd !== undefined && amount > 0 && <span className="text-muted-foreground text-xs">{formatFiat(usd)}</span>}
    </div>
  )
}

export function Portfolio({ address }: { address: Address }) {
  const chains = useChains()
  const { balances, isLoading, isFetching, refetch } = useBalances(address)
  const prices = usePrices()
  const p = prices.data

  // Testnet tokens have no market value, so they're left out of the total.
  const total = p
    ? balances.reduce((sum, b) => {
        const chain = chains.find((c) => c.id === b.chainId)
        if (chain?.testnet) return sum
        const price = nativeUsd(p, chain) ?? 0
        return sum + (b.eth ? toEth(b.eth) * price : 0) + (b.usdc ? toUsdc(b.usdc) * p.usdc : 0)
      }, 0)
    : undefined
  const anyLoaded = balances.some((b) => b.eth !== undefined || b.usdc !== undefined)
  const unreachable = chains.filter((c) => balances.find((b) => b.chainId === c.id)?.failed).map((c) => c.name)

  return (
    <Card className="md:col-span-2">
      <CardHeader className="flex flex-row items-start justify-between">
        <div className="grid gap-1.5">
          <CardDescription>Total value (mainnets)</CardDescription>
          <CardTitle className="text-3xl tabular-nums">
            {total !== undefined && anyLoaded ? formatFiat(total) : isLoading || prices.isLoading ? '…' : '—'}
          </CardTitle>
          {p ? (
            <p className="text-muted-foreground text-xs">
              1 ETH = {formatFiat(p.eth)}
              {p.pol !== undefined && ` · 1 POL = ${formatFiat(p.pol)}`} · prices from CoinGecko
            </p>
          ) : (
            prices.isError && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Prices are unavailable right now — balances are still accurate.
              </p>
            )
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Refresh balances"
          onClick={() => {
            refetch()
            prices.refetch()
          }}
        >
          <RefreshCw className={isFetching ? 'animate-spin' : undefined} />
        </Button>
      </CardHeader>
      <CardContent>
        {unreachable.length > 0 && (
          <p role="status" className="mb-3 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
            <WifiOff className="mt-px size-3.5 shrink-0" aria-hidden />
            Couldn’t reach {unreachable.join(', ')} just now — showing the last known balance where there is one. It
            retries automatically.
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left">
                <th className="py-2 font-medium">Network</th>
                <th className="py-2 text-right font-medium">Coin</th>
                <th className="py-2 text-right font-medium">USDC</th>
              </tr>
            </thead>
            <tbody>
              {chains.map((chain) => {
                const b = balances.find((x) => x.chainId === chain.id)
                const eth = b?.eth !== undefined ? toEth(b.eth) : undefined
                const usdc = b?.usdc !== undefined ? toUsdc(b.usdc) : undefined
                const priced = p && !chain.testnet
                const coinPrice = nativeUsd(p, chain)
                return (
                  <tr key={chain.id} className="border-b align-top last:border-0">
                    <td className="py-3">
                      <span className="font-medium">{chain.name}</span>
                      {chain.testnet && (
                        <span className="bg-muted text-muted-foreground ml-2 rounded px-1.5 py-0.5 text-xs">
                          testnet
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      <Cell
                        amount={eth}
                        unit={chain.nativeCurrency.symbol}
                        usd={coinPrice !== undefined && eth !== undefined ? eth * coinPrice : undefined}
                        loading={isLoading}
                      />
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      <Cell
                        amount={usdc}
                        usd={priced && usdc !== undefined ? usdc * p.usdc : undefined}
                        loading={isLoading}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
