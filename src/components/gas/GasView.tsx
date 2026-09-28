import { useEffect, useRef, useState } from 'react'
import { formatGwei, formatUnits, parseGwei } from 'viem'
import { useBlockNumber, useChains, useEstimateFeesPerGas } from 'wagmi'
import { mainnet, base } from 'wagmi/chains'
import { BellRing, Fuel, PartyPopper, Trophy } from 'lucide-react'

import { PriceAlert } from '@/components/gas/PriceAlert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatFiat, usePrices } from '@/lib/prices'
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
    return prices.data && !testnet ? formatFiat(eth * prices.data.eth) : `${formatAmount(eth, 6)} ETH`
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

type AlertSettings = { chainId: ChainId; gwei: string; enabled: boolean }
const ALERT_KEY = 'gas-alert'

function loadAlert(): AlertSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(ALERT_KEY) ?? 'null') as AlertSettings | null
    if (saved && typeof saved.gwei === 'string') return saved
  } catch {
    // ignore
  }
  return { chainId: mainnet.id, gwei: '', enabled: false }
}

function parseTarget(gwei: string) {
  if (!/^\d*\.?\d+$/.test(gwei)) return undefined
  try {
    return parseGwei(gwei)
  } catch {
    return undefined
  }
}

function GasAlert({ fees }: { fees: Record<number, bigint | undefined> }) {
  const [settings, setSettings] = useState(loadAlert)
  const [permission, setPermission] = useState(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  )
  const update = (next: Partial<AlertSettings>) => {
    const merged = { ...settings, ...next }
    setSettings(merged)
    try {
      localStorage.setItem(ALERT_KEY, JSON.stringify(merged))
    } catch {
      // ignore
    }
  }

  const target = parseTarget(settings.gwei)
  const current = fees[settings.chainId]
  const below = settings.enabled && target !== undefined && current !== undefined && current <= target
  const name = settings.chainId === base.id ? 'Base' : 'Ethereum'

  // Fire a desktop notification when gas crosses below the target (not on every refresh).
  const wasBelow = useRef(false)
  useEffect(() => {
    if (below && !wasBelow.current && permission === 'granted') {
      try {
        new Notification(`${name} gas is ${formatAmount(Number(formatGwei(current!)), 3)} gwei`, {
          body: `Below your ${settings.gwei} gwei target — good time to transact.`,
          tag: 'gas-alert',
        })
      } catch {
        // notifications may require a service worker on some browsers
      }
    }
    wasBelow.current = below
  }, [below, permission, name, current, settings.gwei])

  async function enable() {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default')
      setPermission(await Notification.requestPermission())
    update({ enabled: true })
  }

  return (
    <Card className={cn(below && 'ring-2 ring-emerald-500')}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="size-5" /> Gas alert
        </CardTitle>
        <CardDescription>
          Get pinged when gas drops below your target. Checks every 12 seconds while open.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>When</span>
          <div className="bg-muted inline-flex rounded-md p-1">
            {[mainnet, base].map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={settings.chainId === c.id}
                onClick={() => update({ chainId: c.id })}
                className={cn(
                  'rounded px-3 py-1 font-medium',
                  settings.chainId === c.id ? 'bg-background shadow-xs' : 'text-muted-foreground',
                )}
              >
                {c.id === base.id ? 'Base' : 'Ethereum'}
              </button>
            ))}
          </div>
          <span>gas is below</span>
          <Input
            aria-label="Target gas in gwei"
            inputMode="decimal"
            className="w-24"
            placeholder="5"
            value={settings.gwei}
            onChange={(e) => update({ gwei: e.target.value.trim() })}
            aria-invalid={settings.gwei !== '' && target === undefined}
          />
          <span>gwei</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {settings.enabled ? (
            <Button variant="outline" onClick={() => update({ enabled: false })}>
              Turn alert off
            </Button>
          ) : (
            <Button onClick={enable} disabled={target === undefined}>
              <BellRing /> Turn alert on
            </Button>
          )}
          <span className="text-muted-foreground text-xs">
            Now: {current !== undefined ? `${formatAmount(Number(formatGwei(current)), 4)} gwei` : '…'}
            {permission === 'denied' && ' · desktop notifications are blocked in your browser'}
          </span>
        </div>
        {below && (
          <p className="flex items-center gap-2 rounded-md bg-emerald-500/10 p-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            <PartyPopper className="size-4" /> {name} gas is below {settings.gwei} gwei right now — go!
          </p>
        )}
        {settings.enabled && !below && target !== undefined && (
          <p className="text-muted-foreground text-xs">
            Watching {name}… we’ll tell you when it dips below {settings.gwei} gwei.
          </p>
        )}
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
          <Fuel className="text-primary size-6" /> Live gas tracker
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          What common actions cost right now on each network, updated every block. Base prices exclude its small L1 data
          fee.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {chains.map((c) => (
          <ChainGasCard key={c.id} chainId={c.id} name={c.name} testnet={c.testnet} cheapest={c.id === cheapestId} />
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <GasAlert fees={{ [mainnet.id]: eth.perGas, [base.id]: l2.perGas }} />
        <PriceAlert />
      </div>
    </div>
  )
}
