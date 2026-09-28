import { useMemo, useRef, useState, type FormEvent } from 'react'
import { formatUnits, isAddress, type Address } from 'viem'
import { normalize } from 'viem/ens'
import { useChains, useConnection, useEnsAddress, useEnsName } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { ChevronLeft, ChevronRight, Download, Share2, Sparkles } from 'lucide-react'

import { CountUp } from '@/components/wrapped/CountUp'
import { drawShareCard } from '@/components/wrapped/shareCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BLOCKSCOUT, useWrapped } from '@/lib/blockscout'
import { formatFiat, usePrices } from '@/lib/prices'
import { navigate } from '@/lib/route'
import { cn, formatAmount, shortenAddress } from '@/lib/utils'
import { hourLabel, type WrappedStats } from '@/lib/wrapped'

function safeNormalize(name: string) {
  try {
    return normalize(name)
  } catch {
    return undefined
  }
}

const GRADIENTS = [
  'from-indigo-950 via-violet-700 to-fuchsia-600',
  'from-sky-900 via-cyan-700 to-emerald-500',
  'from-rose-900 via-orange-600 to-amber-400',
  'from-emerald-950 via-teal-700 to-lime-500',
  'from-slate-900 via-indigo-800 to-sky-500',
  'from-fuchsia-950 via-pink-700 to-orange-400',
]

type Slide = { kicker: string; big: string; sub?: string; count?: boolean }

const SLIDE_MS = 5000

function buildSlides(s: WrappedStats, label: string, chainName: string, fees: string): Slide[] {
  const slides: Slide[] = [
    { kicker: `Wallet Wrapped · ${chainName}`, big: label, sub: 'Tap next to see your on-chain story.' },
    {
      kicker: 'You made',
      big: `${s.totalTx.toLocaleString()} transactions`,
      count: true,
      sub: s.tokenTransfers ? `…and moved tokens ${s.tokenTransfers.toLocaleString()} times.` : undefined,
    },
  ]
  if (s.firstSeen && s.ageDays !== undefined)
    slides.push({
      kicker: s.firstSeenIsExact ? 'On-chain since' : 'On-chain since at least',
      big: s.firstSeen.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
      sub: `That’s ${s.ageDays.toLocaleString()} days.`,
    })
  if (s.topPlace)
    slides.push({
      kicker: 'Your favourite place',
      big: s.topPlace.name ?? shortenAddress(s.topPlace.address),
      sub: `You went there ${s.topPlace.count} times in your last ${s.sampleSize} transactions.`,
    })
  if (s.busiestHour !== undefined)
    slides.push({
      kicker: 'Your prime time',
      big: `${s.busiestWeekday}s at ${hourLabel(s.busiestHour)}`,
      sub: 'When you’re most likely to hit “confirm”.',
    })
  if (s.sampleSize > 0)
    slides.push({
      kicker: 'You paid the network',
      big: fees,
      count: true,
      sub: `in fees across your last ${s.sampleSize} transactions${s.failRate > 0 ? `, and ${Math.round(s.failRate * 100)}% of your sends failed` : ''}.`,
    })
  slides.push({
    kicker: 'Your on-chain personality',
    big: `${s.persona.emoji} ${s.persona.title}`,
    sub: s.persona.blurb,
  })
  return slides
}

export function WrappedView({ target }: { target?: string }) {
  const { address: connected } = useConnection()
  const chains = useChains()
  const prices = usePrices()
  const [chainId, setChainId] = useState<number>(chains[0].id)
  const [input, setInput] = useState(target ?? '')
  const [slide, setSlide] = useState(0)
  const [paused, setPaused] = useState(false)
  // A long press pauses the story; releasing it shouldn't also count as a tap.
  const pressedAt = useRef(0)
  const wasTap = () => Date.now() - pressedAt.current < 300
  const [reduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)

  // Who to wrap: the route target (address or ENS), else the connected wallet.
  const query = target ?? connected ?? ''
  const ensName = !isAddress(query) && query.includes('.') ? safeNormalize(query) : undefined
  const ens = useEnsAddress({ name: ensName, chainId: mainnet.id, query: { enabled: !!ensName } })
  const address: Address | undefined = isAddress(query) ? query : (ens.data ?? undefined)
  const reverse = useEnsName({ address, chainId: mainnet.id, query: { enabled: !!address && !ensName } })
  const label = ensName ?? reverse.data ?? (address ? shortenAddress(address) : '')

  const wrapped = useWrapped(address, chainId)
  const chainName = chains.find((c) => c.id === chainId)?.name ?? ''
  const testnet = chains.find((c) => c.id === chainId)?.testnet

  const stats = wrapped.data
  const feesEth = stats ? Number(formatUnits(stats.feesWei, 18)) : 0
  const feesText = prices.data && !testnet ? formatFiat(feesEth * prices.data.eth) : `${formatAmount(feesEth, 5)} ETH`
  const slides = useMemo(
    () => (stats ? buildSlides(stats, label, chainName, feesText) : []),
    [stats, label, chainName, feesText],
  )
  const last = slides.length - 1
  const current = slides[Math.min(slide, last)]

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const v = input.trim()
    if (v) navigate({ view: 'wrapped', target: v })
  }

  function download() {
    if (!stats) return
    const url = drawShareCard({ stats, label, chainName, feesText })
    const a = document.createElement('a')
    a.href = url
    a.download = `wallet-wrapped-${label.replace(/[^\w.-]/g, '')}.png`
    a.click()
  }

  const shareUrl = `${window.location.origin}${window.location.pathname}#/wrapped/${encodeURIComponent(ensName ?? address ?? '')}`
  const tweet = stats
    ? `My Wallet Wrapped on ${chainName}: I'm a ${stats.persona.emoji} ${stats.persona.title} with ${stats.totalTx.toLocaleString()} transactions. What's yours? (via Wallet Bodyguard)`
    : ''

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Sparkles className="text-primary size-6" /> Wallet Wrapped
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          The story of any wallet, from real on-chain data. Try yours, a friend’s, or vitalik.eth.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            connected ? `${shortenAddress(connected)} (you) — or any address / name.eth` : 'Address or name.eth'
          }
          className="font-mono"
          spellCheck={false}
          autoComplete="off"
          aria-label="Wallet to wrap"
        />
        <Button type="submit">Wrap it</Button>
      </form>

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
                setSlide(0)
              }}
            >
              {c.name}
            </Button>
          ))}
      </div>

      {!query ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">
          Connect your wallet or enter any address or ENS name above.
        </p>
      ) : ensName && ens.isLoading ? (
        <p className="text-muted-foreground p-10 text-center text-sm">Looking up {ensName}…</p>
      ) : !address ? (
        <p className="text-destructive p-10 text-center text-sm">Couldn’t find a wallet for “{query}”.</p>
      ) : wrapped.isLoading ? (
        <div className="flex aspect-[4/5] max-h-[560px] w-full items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-950 via-violet-700 to-fuchsia-600 text-white">
          <p className="animate-pulse text-lg font-medium">
            Reading {label}’s history on {chainName}…
          </p>
        </div>
      ) : wrapped.isError || !current ? (
        <p className="text-destructive p-10 text-center text-sm">
          Couldn’t load history from the {chainName} explorer right now. Try again in a minute.
        </p>
      ) : (
        <div className="mx-auto flex w-full max-w-md flex-col gap-4">
          <div
            tabIndex={0}
            aria-roledescription="story"
            aria-label={`Slide ${Math.min(slide, last) + 1} of ${slides.length}. Hold to pause; arrow keys to move.`}
            onPointerDown={() => {
              pressedAt.current = Date.now()
              setPaused(true)
            }}
            onPointerUp={() => setPaused(false)}
            onPointerLeave={() => setPaused(false)}
            onPointerCancel={() => setPaused(false)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') setSlide((s) => Math.min(last, s + 1))
              if (e.key === 'ArrowLeft') setSlide((s) => Math.max(0, s - 1))
            }}
            className={cn(
              'relative flex aspect-[4/5] w-full touch-none flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br p-8 text-white shadow-2xl transition-colors duration-500 outline-none select-none focus-visible:ring-4 focus-visible:ring-white/60',
              GRADIENTS[slide % GRADIENTS.length],
            )}
          >
            {/* Story progress: the current bar fills over SLIDE_MS, then advances (holding pauses it). */}
            <div className="flex gap-1">
              {slides.map((_, i) => (
                <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
                  {i < slide || (i === slide && (reduced || slide >= last)) ? (
                    <span className="block h-full w-full bg-white" />
                  ) : i === slide ? (
                    <span
                      key={slide}
                      className="story-fill block h-full bg-white"
                      style={{ animationDuration: `${SLIDE_MS}ms`, animationPlayState: paused ? 'paused' : 'running' }}
                      onAnimationEnd={() => setSlide((s) => Math.min(last, s + 1))}
                    />
                  ) : null}
                </span>
              ))}
            </div>
            <div key={slide} className="animate-rise flex flex-col gap-3">
              <p className="text-sm font-medium tracking-wide uppercase opacity-80">{current.kicker}</p>
              <p className="text-4xl leading-tight font-extrabold break-words sm:text-5xl">
                {current.count ? <CountUp text={current.big} /> : current.big}
              </p>
              {current.sub && <p className="text-lg opacity-90">{current.sub}</p>}
            </div>
            <p className="text-xs opacity-70">
              {label} · {chainName}
            </p>
            <button
              aria-label="Previous slide"
              className="absolute inset-y-0 left-0 w-1/3"
              onClick={() => wasTap() && setSlide((s) => Math.max(0, s - 1))}
            />
            <button
              aria-label="Next slide"
              className="absolute inset-y-0 right-0 w-2/3"
              onClick={() => wasTap() && setSlide((s) => Math.min(last, s + 1))}
            />
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSlide((s) => Math.max(0, s - 1))}
              disabled={slide === 0}
            >
              <ChevronLeft /> Back
            </Button>
            <span className="text-muted-foreground text-xs">
              {Math.min(slide, last) + 1} / {slides.length}
            </span>
            <Button size="sm" onClick={() => setSlide((s) => Math.min(last, s + 1))} disabled={slide >= last}>
              Next <ChevronRight />
            </Button>
          </div>

          {slide >= last && stats && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1" onClick={download}>
                <Download /> Download share card
              </Button>
              <Button className="flex-1" variant="outline" asChild>
                <a
                  href={`https://x.com/intent/post?text=${encodeURIComponent(tweet)}&url=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Share2 /> Share on X
                </a>
              </Button>
            </div>
          )}
          <p className="text-muted-foreground text-center text-xs">
            Based on lifetime counts plus the latest {stats?.sampleSize ?? 0} transactions, via Blockscout.
          </p>
        </div>
      )}
    </div>
  )
}
