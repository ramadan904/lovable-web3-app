import { erc20Abi, formatUnits, type Address } from 'viem'
import { useBalance, useChains, useReadContracts } from 'wagmi'
import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { USDC, USDC_DECIMALS } from '@/lib/tokens'
import { formatAmount } from '@/lib/utils'
import type { ChainId } from '@/lib/wagmi'

function EthBalance({ address, chainId }: { address: Address; chainId: ChainId }) {
  const { data, isLoading, isError } = useBalance({ address, chainId })
  if (isLoading) return <span className="text-muted-foreground">…</span>
  if (isError || !data) return <span className="text-muted-foreground">—</span>
  return <>{formatAmount(Number(formatUnits(data.value, data.decimals)))}</>
}

export function Portfolio({ address }: { address: Address }) {
  const chains = useChains()
  const usdc = useReadContracts({
    contracts: chains.map((chain) => ({
      address: USDC[chain.id],
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address],
      chainId: chain.id,
    })),
  })

  return (
    <Card className="md:col-span-2">
      <CardHeader className="flex flex-row items-start justify-between">
        <div className="grid gap-1.5">
          <CardTitle>Portfolio</CardTitle>
          <CardDescription>ETH and USDC held by this address on each network.</CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Refresh balances"
          onClick={() => usdc.refetch()}
        >
          <RefreshCw className={usdc.isFetching ? 'animate-spin' : undefined} />
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
              {chains.map((chain, i) => {
                const result = usdc.data?.[i]
                const usdcValue =
                  result?.status === 'success'
                    ? formatAmount(Number(formatUnits(result.result as bigint, USDC_DECIMALS)), 2)
                    : usdc.isLoading
                      ? '…'
                      : '—'
                return (
                  <tr key={chain.id} className="border-b last:border-0">
                    <td className="py-3">
                      <span className="font-medium">{chain.name}</span>
                      {chain.testnet && (
                        <span className="bg-muted text-muted-foreground ml-2 rounded px-1.5 py-0.5 text-xs">
                          testnet
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      <EthBalance address={address} chainId={chain.id} />
                    </td>
                    <td className="py-3 text-right tabular-nums">{usdcValue}</td>
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
