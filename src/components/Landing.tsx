import { lazy, Suspense, useState, type FormEvent, type ReactNode } from 'react'
import { formatGwei } from 'viem'
import { useEstimateFeesPerGas } from 'wagmi'
import { base, mainnet } from 'wagmi/chains'
import {
  ArrowDown,
  ArrowRight,
  Eye,
  Fingerprint,
  Fuel,
  Link2,
  PiggyBank,
  ScrollText,
  Search,
  type LucideIcon,
} from 'lucide-react'

import { ConnectCard } from '@/components/ConnectCard'
import { HoloCard } from '@/components/dashboard/HoloCard'
import { Threshold } from '@/components/threshold/Threshold'
import { navigate, type Route } from '@/lib/route'
import { formatAmount } from '@/lib/utils'

const VITALIK = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
const WrappedView = lazy(() => import('@/components/wrapped/WrappedView').then((m) => ({ default: m.WrappedView })))

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

function SectionHead({
  n,
  kicker,
  title,
  children,
}: {
  n: string
  kicker: string
  title: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground font-mono text-[11px] tracking-[0.25em] uppercase">
        {n} · {kicker}
      </p>
      <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {children && <div className="text-muted-foreground max-w-xl text-base">{children}</div>}
    </div>
  )
}

/** "Wallet or name" box that sends the visitor straight into a tool. */
function Lookup({ to, cta, placeholder }: { to: Route['view']; cta: string; placeholder: string }) {
  const [value, setValue] = useState('')
  function submit(e: FormEvent) {
    e.preventDefault()
    const v = value.trim()
    if (v) navigate({ view: to, target: v })
  }
  return (
    <form onSubmit={submit} className="flex w-full max-w-md gap-2">
      <label className="relative flex-1">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          spellCheck={false}
          autoComplete="off"
          className="bg-background focus:ring-ring/40 h-11 w-full rounded-lg border pr-3 pl-9 font-mono text-sm outline-none focus:ring-4"
        />
      </label>
      <button
        type="submit"
        className="bg-foreground text-background h-11 shrink-0 rounded-lg px-4 text-sm font-semibold transition hover:opacity-90"
      >
        {cta}
      </button>
    </form>
  )
}

function StorySkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading Wallet Wrapped"
      className="mx-auto flex aspect-[4/5] w-full max-w-md flex-col justify-between rounded-3xl bg-gradient-to-br from-indigo-950 via-violet-800 to-fuchsia-700 p-8"
    >
      <span className="skeleton-light h-1 w-full rounded-full" />
      <div className="flex flex-col gap-3">
        <span className="skeleton-light h-3 w-32 rounded" />
        <span className="skeleton-light h-10 w-4/5 rounded-lg" />
        <span className="skeleton-light h-4 w-2/3 rounded" />
      </div>
      <span className="skeleton-light h-3 w-24 rounded" />
    </div>
  )
}

function LiveGas() {
  const eth = useEstimateFeesPerGas({ chainId: mainnet.id, query: { refetchInterval: 12_000 } })
  const l2 = useEstimateFeesPerGas({ chainId: base.id, query: { refetchInterval: 12_000 } })
  const gwei = (d: typeof eth.data) => {
    const v = d?.maxFeePerGas ?? d?.gasPrice
    return v === undefined ? undefined : formatAmount(Number(formatGwei(v)), 3)
  }
  const e = gwei(eth.data)
  const b = gwei(l2.data)
  if (!e && !b) return <span className="skeleton inline-block h-3 w-32 rounded" aria-label="Loading gas" />
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
      </span>
      Ethereum {e ?? '—'} · Base {b ?? '—'} gwei
    </span>
  )
}

type Tool = { icon: LucideIcon; title: string; body: ReactNode; to: Route; needsWallet?: boolean }
const TOOLS: Tool[] = [
  {
    icon: ScrollText,
    title: 'Transaction explainer',
    body: 'Paste any tx hash; get it in plain English.',
    to: { view: 'tx' },
  },
  { icon: Fuel, title: 'Live gas', body: <LiveGas />, to: { view: 'gas' } },
  {
    icon: Eye,
    title: 'Look inside any wallet',
    body: 'Balances, tokens, NFTs and its galaxy of contacts.',
    to: { view: 'view', target: 'vitalik.eth' },
  },
  { icon: Eye, title: 'Whale Watch', body: 'Follow wallets; get alerted when they move.', to: { view: 'watch' } },
  {
    icon: PiggyBank,
    title: 'Savings Lock',
    body: 'Time-lock ETH in your own contract.',
    to: { view: 'lock' },
    needsWallet: true,
  },
  {
    icon: Link2,
    title: 'Payment links',
    body: 'Request an exact amount, Shield-checked for the payer.',
    to: { view: 'dashboard' },
    needsWallet: true,
  },
  {
    icon: Fingerprint,
    title: 'Proof of ownership',
    body: 'Prove a wallet is yours with a free signature.',
    to: { view: 'prove' },
    needsWallet: true,
  },
]

export function Landing() {
  return (
    <div className="flex flex-col gap-20 py-4 sm:gap-28">
      <section className="relative isolate">
        {/* drifting brand-colour glow behind the hero (decorative) */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-visible">
          <div className="hero-blob bg-brand-from top-[-10%] left-[-5%] size-72" />
          <div className="hero-blob hero-blob-2 bg-brand-via top-[30%] right-[-5%] size-80" />
          <div className="hero-blob hero-blob-3 bg-brand-to bottom-[-15%] left-[35%] size-64" />
        </div>
        <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
          <div className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
            <p className="bg-background/70 text-muted-foreground w-fit rounded-full border px-3 py-1 text-xs font-medium backdrop-blur">
              Ethereum · Base · Arbitrum · Optimism · Polygon
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight text-balance sm:text-6xl">
              The pause <span className="text-brand">before you sign.</span>
            </h1>
            <p className="text-muted-foreground max-w-xl text-lg text-pretty">
              Every transaction is permanent. Wallet Bodyguard stands between you and the confirm button — it checks who
              you’re paying, spots look-alike scams, and simulates exactly what will move. Try it right now, no wallet
              needed.
            </p>
            <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
              <button
                onClick={() => scrollTo('threshold')}
                className="bg-foreground text-background flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-semibold transition hover:opacity-90"
              >
                Run a check <ArrowDown className="size-4" />
              </button>
              <button
                onClick={() => scrollTo('connect')}
                className="bg-background/70 flex h-11 items-center gap-2 rounded-lg border px-5 text-sm font-semibold backdrop-blur transition hover:bg-muted"
              >
                Connect a wallet
              </button>
            </div>
            <p className="text-muted-foreground text-xs">
              Open source · runs in your browser · never touches your keys
            </p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
              Live · vitalik.eth’s card
            </p>
            <HoloCard address={VITALIK} holder="vitalik.eth" className="w-full" hint="Move over it · tap to flip" />
          </div>
        </div>
      </section>

      <Threshold />

      <section className="grid items-center gap-10 lg:grid-cols-[1fr_1fr]">
        <div className="flex flex-col gap-6">
          <SectionHead n="02" kicker="Wallet Wrapped" title="Every wallet has a story.">
            Real on-chain history turned into a story: how long it’s been around, where it goes most, when it signs,
            what it’s paid in fees — and its on-chain personality. This one is playing live for vitalik.eth.
          </SectionHead>
          <Lookup to="wrapped" cta="Wrap it" placeholder="Any address or name.eth" />
        </div>
        <Suspense fallback={<StorySkeleton />}>
          <WrappedView target="vitalik.eth" embedded />
        </Suspense>
      </section>

      <section className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
        <div className="flex flex-col gap-6">
          <SectionHead n="03" kicker="Wallet Guard" title="See what can still move your money.">
            Every app you’ve used may still hold permission to spend your tokens — often unlimited, often forever. Guard
            finds them all, scores the wallet’s health and lets the owner revoke with one simulated, reviewed signature.
            Check any wallet, read-only.
          </SectionHead>
          <Lookup to="approvals" cta="Check" placeholder="Any address or name.eth" />
          <button
            className="text-muted-foreground w-fit text-sm underline underline-offset-4"
            onClick={() => navigate({ view: 'approvals', target: 'vitalik.eth' })}
          >
            Or check vitalik.eth →
          </button>
        </div>
        <ol className="grid gap-3">
          {[
            ['Dangerous approvals', 'Spenders that are plain wallets — the classic drainer pattern.', '−45'],
            ['Risky approvals', 'Unlimited amounts, unverified contracts, whole NFT collections.', '−30'],
            ['Address poisoning', 'Fake transfers from look-alikes of addresses you really use.', '−20'],
            ['Scam tokens', 'Airdrops that bait you to a drainer site.', '−10'],
          ].map(([title, body, pts]) => (
            <li key={title} className="bg-card flex items-start gap-4 rounded-xl border p-4">
              <span className="text-muted-foreground w-10 shrink-0 pt-0.5 font-mono text-sm tabular-nums">{pts}</span>
              <div>
                <p className="font-medium">{title}</p>
                <p className="text-muted-foreground text-sm">{body}</p>
              </div>
            </li>
          ))}
          <li className="text-muted-foreground px-1 text-xs">
            Health starts at 100; each finding costs points up to the cap shown. Export the full report as a page or
            JSON.
          </li>
        </ol>
      </section>

      <section className="flex flex-col gap-6">
        <SectionHead n="04" kicker="The rest of the kit" title="Small tools, done properly." />
        <ul className="divide-y rounded-2xl border">
          {TOOLS.map((t) => {
            const Icon = t.icon
            return (
              <li key={t.title}>
                <button
                  onClick={() => navigate(t.to)}
                  className="group hover:bg-muted/50 flex w-full items-center gap-4 px-4 py-4 text-left transition sm:px-5"
                >
                  <Icon className="text-muted-foreground size-5 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{t.title}</span>
                    {t.needsWallet && (
                      <span className="text-muted-foreground ml-2 rounded border px-1.5 py-px text-[10px] tracking-wide uppercase">
                        with a wallet
                      </span>
                    )}
                    <span className="text-muted-foreground block text-sm">{t.body}</span>
                  </span>
                  <ArrowRight className="text-muted-foreground size-4 shrink-0 transition group-hover:translate-x-0.5" />
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section id="connect" className="grid scroll-mt-24 items-center gap-8 lg:grid-cols-[1fr_auto]">
        <SectionHead n="05" kicker="Your wallet" title="Put a bodyguard on your own sends.">
          Connect and every send, revoke and savings lock goes through the Threshold first — checked, simulated, and
          explained before your wallet ever asks you to sign. Nothing is stored on a server.
        </SectionHead>
        <ConnectCard />
      </section>
    </div>
  )
}
