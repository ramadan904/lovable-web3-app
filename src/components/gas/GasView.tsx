import { formatGwei, formatUnits } from 'viem'
import { useBlockNumber, useChains, useEstimateFeesPerGas } from 'wagmi'
import { mainnet, base } from 'wagmi/chains'
import { Fuel, Trophy } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatUsd, usePrices } from '@/lib/prices'
import { cn, formatAmount } from '@/lib/utils'
import type { ChainId } from '@/lib/wagmi'

const ACTIONS = [
  { label: 'Send ETH', gas: 21_000n },
  { label: 'Send USDC', gas: 65_000n },
  { label: 'Token swap', gas: 180_000n },
  { label: 'Mint an NFT', gas: 120_000n },
]

function useFeePerGas(chainId: ChainId) {
  const fees = useEstimateFeesPerGas({ chainId, query: { refetchInterval: 12_000 } })
  return { perGas: fees.data?.maxFeePerGas ?? fees.data?.gasPrice, loading: fees.isLoading, error: fees.isError }
}

function ChainGasCard({
  chainId,
  name,
  testnet,
  cheapest,
}: {
  chainId: ChainId
  name: string
  testnet?: boolean
  cheapest: boolean
}) {
  const { perGas, loading, error } = useFeePerGas(chainId)
  const block = useBlockNumber({ chainId, watch: true })
  const prices = usePrices()
  const cost = (gas: bigint) => {
    if (perGas === undefined) return '—'
    const eth = Number(formatUnits(gas * perGas, 18))
    return prices.data && !testnet ? formatUsd(eth * prices.data.eth) : `${formatAmount(eth, 6)} ETH`
  }

  return (
    <Card className={cn(cheapest && 'ring-2 ring-emerald-500')}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            {name}
            {testnet && (
              <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs font-normal">testnet</span>
            )}
          </CardTitle>
          {cheapest && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <Trophy className="size-3" /> Cheapest now
            </span>
          )}
        </div>
        <CardDescription className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          {block.data !== undefined ? `Live · block ${block.data.toLocaleString()}` : 'Connecting…'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-3xl font-semibold tabular-nums">
          {loading ? '…' : error || perGas === undefined ? '—' : formatAmount(Number(formatGwei(perGas)), 4)}
          <span className="text-muted-foreground ml-1 text-sm font-normal">gwei</span>
        </p>
        <table className="w-full text-sm">
          <tbody>
            {ACTIONS.map((a) => (
              <tr key={a.label} className="border-b last:border-0">
                <td className="text-muted-foreground py-2">{a.label}</td>
                <td className="py-2 text-right tabular-nums">{cost(a.gas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

export function GasView() {
  const chains = useChains()
  // Cheapest is judged between the two mainnets; these share the cards' cached queries.
  const eth = useFeePerGas(mainnet.id)
  const l2 = useFeePerGas(base.id)
  const cheapestId =
    eth.perGas !== undefined && l2.perGas !== undefined ? (l2.perGas <= eth.perGas ? base.id : mainnet.id) : undefined

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Fuel className="size-6" /> Live gas tracker
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          What common actions cost right now on each network, updated every block. Base prices exclude its small L1
          data fee.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {chains.map((c) => (
          <ChainGasCard key={c.id} chainId={c.id} name={c.name} testnet={c.testnet} cheapest={c.id === cheapestId} />
        ))}
      </div>
    </div>
  )
}
