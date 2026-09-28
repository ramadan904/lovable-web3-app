import { useEffect, useState } from 'react'
import { formatGwei } from 'viem'
import { useWatchBlocks } from 'wagmi'
import { base, mainnet } from 'wagmi/chains'
import { Activity } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatAmount } from '@/lib/utils'

type Tick = { number: bigint; timestamp: number; txs: number; fullness: number; baseFee?: bigint }
const KEEP = 14
const CHAINS = [
  { id: base.id, name: 'Base', blockTime: '~2 s' },
  { id: mainnet.id, name: 'Ethereum', blockTime: '~12 s' },
] as const

/** Live strip of the latest blocks: each tile's fill is how full the block was. */
export function BlockPulse() {
  const [chainId, setChainId] = useState<(typeof CHAINS)[number]['id']>(base.id)
  const [blocks, setBlocks] = useState<Tick[]>([])
  const [hovered, setHovered] = useState<bigint>()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useWatchBlocks({
    chainId,
    emitOnBegin: true,
    onBlock(block) {
      if (block.number == null) return
      const tick: Tick = {
        number: block.number,
        timestamp: Number(block.timestamp) * 1000,
        txs: block.transactions.length,
        fullness: block.gasLimit > 0n ? Number((block.gasUsed * 1000n) / block.gasLimit) / 10 : 0,
        baseFee: block.baseFeePerGas ?? undefined,
      }
      setBlocks((prev) =>
        [tick, ...prev.filter((b) => b.number !== tick.number)]
          .sort((a, b) => Number(b.number - a.number))
          .slice(0, KEEP),
      )
    },
  })

  const chain = CHAINS.find((c) => c.id === chainId)!
  const latest = blocks[0]
  const shown = blocks.find((b) => b.number === hovered) ?? latest
  const avgTxs = blocks.length ? Math.round(blocks.reduce((s, b) => s + b.txs, 0) / blocks.length) : undefined

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1.5">
          <CardTitle className="flex items-center gap-2">
            <Activity className="text-primary size-5" /> Block pulse
            <span className="relative flex size-2">
              <span className="bg-primary absolute inline-flex size-full animate-ping rounded-full opacity-75" />
              <span className="bg-primary relative inline-flex size-2 rounded-full" />
            </span>
          </CardTitle>
          <CardDescription>
            The {chain.name} chain’s heartbeat — a new block every {chain.blockTime}. Bar height = how full the block
            was.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          {CHAINS.map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant={c.id === chainId ? 'default' : 'outline'}
              onClick={() => {
                setChainId(c.id)
                setBlocks([])
              }}
            >
              {c.name}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm" aria-live="polite">
          {shown ? (
            <>
              <span>
                Block <strong className="tabular-nums">#{shown.number.toLocaleString()}</strong>
              </span>
              <span>
                <strong className="tabular-nums">{shown.txs}</strong> transactions
              </span>
              <span>
                <strong className="tabular-nums">{formatAmount(shown.fullness, 1)}%</strong> full
              </span>
              {shown.baseFee !== undefined && (
                <span>
                  base fee{' '}
                  <strong className="tabular-nums">{formatAmount(Number(formatGwei(shown.baseFee)), 4)}</strong> gwei
                </span>
              )}
              <span className="text-muted-foreground">
                {Math.max(0, Math.round((now - shown.timestamp) / 1000))}s ago
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">Listening for blocks…</span>
          )}
        </div>

        <div className="flex h-32 items-end gap-1.5 sm:gap-2" role="list" aria-label={`Latest ${chain.name} blocks`}>
          {blocks.map((b, i) => (
            <div
              key={b.number.toString()}
              role="listitem"
              tabIndex={0}
              aria-label={`Block ${b.number}: ${b.txs} transactions, ${formatAmount(b.fullness, 1)}% full`}
              onPointerEnter={() => setHovered(b.number)}
              onPointerLeave={() => setHovered(undefined)}
              onFocus={() => setHovered(b.number)}
              onBlur={() => setHovered(undefined)}
              className={cn(
                'block-tile flex h-full min-w-0 flex-1 cursor-default flex-col items-center gap-1',
                i === 0 && 'block-new',
              )}
            >
              <div
                className={cn(
                  'bg-muted relative w-full flex-1 overflow-hidden rounded-md',
                  (hovered ?? latest?.number) === b.number && 'ring-primary ring-2',
                )}
              >
                <div
                  className="from-brand-from to-brand-via absolute inset-x-0 bottom-0 rounded-t-[4px] bg-gradient-to-t transition-[height] duration-500"
                  style={{ height: `${Math.max(3, Math.min(100, b.fullness))}%` }}
                />
              </div>
              <span className="text-muted-foreground text-[10px] tabular-nums sm:text-xs">{b.txs}</span>
            </div>
          ))}
          {Array.from({ length: Math.max(0, KEEP - blocks.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-muted/40 h-full min-w-0 flex-1 rounded-md" aria-hidden />
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          Newest on the left · numbers under each bar are transactions per block
          {avgTxs !== undefined && ` · averaging ${avgTxs} per block`}
        </p>
      </CardContent>
    </Card>
  )
}
