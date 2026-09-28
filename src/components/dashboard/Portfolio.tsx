import type { Address } from 'viem'
import { useChains } from 'wagmi'
import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toEth, toUsdc, useBalances } from '@/lib/balances'
import { formatFiat, usePrices } from '@/lib/prices'
import { formatAmount } from '@/lib/utils'

function Cell({ amount, usd, loading }: { amount?: number; usd?: number; loading: boolean }) {
  if (amount === undefined) return <span className="text-muted-foreground">{loading ? '…' : '—'}</span>
  return (
    <div className="flex flex-col items-end">
      <span>{formatAmount(amount)}</span>
      {usd !== undefined && amount > 0 && (
        <span className="text-muted-foreground text-xs">{formatFiat(usd)}</span>
      )}
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
        return sum + (b.eth ? toEth(b.eth) * p.eth : 0) + (b.usdc ? toUsdc(b.usdc) * p.usdc : 0)
      }, 0)
    : undefined
  const anyLoaded = balances.some((b) => b.eth !== undefined || b.usdc !== undefined)

  return (
    <Card className="md:col-span-2">
      <CardHeader className="flex flex-row items-start justify-between">
        <div className="grid gap-1.5">
          <CardDescription>Total value (mainnets)</CardDescription>
          <CardTitle className="text-3xl tabular-nums">
            {total !== undefined && anyLoaded ? formatFiat(total) : isLoading || prices.isLoading ? '…' : '—'}
          </CardTitle>
          {p && (
            <p className="text-muted-foreground text-xs">
              1 ETH = {formatFiat(p.eth)} · prices from CoinGecko
            </p>
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left">
                <th className="py-2 font-medium">Network</th>
                <th className="py-2 text-right font-medium">ETH</th>
                <th className="py-2 text-right font-medium">USDC</th>
              </tr>
            </thead>
            <tbody>
              {chains.map((chain) => {
                const b = balances.find((x) => x.chainId === chain.id)
                const eth = b?.eth !== undefined ? toEth(b.eth) : undefined
                const usdc = b?.usdc !== undefined ? toUsdc(b.usdc) : undefined
                const priced = p && !chain.testnet
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
                      <Cell amount={eth} usd={priced && eth !== undefined ? eth * p.eth : undefined} loading={isLoading} />
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      <Cell amount={usdc} usd={priced && usdc !== undefined ? usdc * p.usdc : undefined} loading={isLoading} />
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
