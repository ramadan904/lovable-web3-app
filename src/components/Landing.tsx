import {
  ArrowRight,
  Command,
  EyeOff,
  Eye,
  Fingerprint,
  Fuel,
  Link2,
  PiggyBank,
  ScrollText,
  ShieldCheck,
  ShieldHalf,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

import { ConnectCard } from '@/components/ConnectCard'
import { navigate, type Route } from '@/lib/route'

type Feature = {
  icon: LucideIcon
  title: string
  body: string
  tint: string
  /** Where "Try it" goes; features that need a wallet just scroll to Connect. */
  to?: Route
  cta?: string
}

const FEATURES: Feature[] = [
  {
    icon: ShieldCheck,
    title: 'Scam Shield',
    body: 'Checks every recipient before you sign: look-alike “poisoned” addresses, token contracts, brand-new wallets.',
    tint: 'from-emerald-500/20 to-teal-500/5 text-emerald-600',
  },
  {
    icon: Sparkles,
    title: 'Wallet Wrapped',
    body: 'A story-style recap of any wallet — age, favourite apps, prime time, fees and an on-chain personality.',
    tint: 'from-fuchsia-500/20 to-violet-500/5 text-fuchsia-600',
    to: { view: 'wrapped', target: 'vitalik.eth' },
    cta: 'Wrap vitalik.eth',
  },
  {
    icon: ShieldHalf,
    title: 'Wallet Guard',
    body: 'A health score for your wallet: catches address-poisoning scams and risky approvals, and revokes in one click.',
    tint: 'from-amber-500/20 to-orange-500/5 text-amber-600',
  },
  {
    icon: Eye,
    title: 'Whale Watch',
    body: 'Follow any wallet on Ethereum and Base and get a desktop alert the moment it moves.',
    tint: 'from-sky-500/20 to-cyan-500/5 text-sky-600',
    to: { view: 'watch' },
    cta: 'Start watching',
  },
  {
    icon: PiggyBank,
    title: 'Savings Lock',
    body: 'A time-locked piggy bank: deploy your own contract, lock ETH until a date — nobody can touch it before then.',
    tint: 'from-pink-500/20 to-rose-500/5 text-pink-600',
  },
  {
    icon: Command,
    title: 'Plain-English commands',
    body: 'Press Ctrl K and type “send 5 usdc to vitalik.eth on base”. You always review before signing.',
    tint: 'from-slate-500/20 to-slate-500/5 text-slate-600 dark:text-slate-300',
  },
  {
    icon: Link2,
    title: 'Payment links',
    body: 'Request an exact amount on a chosen network; the payer gets a pre-filled, Shield-checked page.',
    tint: 'from-teal-500/20 to-emerald-500/5 text-teal-600',
  },
  {
    icon: Fingerprint,
    title: 'Proof of ownership',
    body: 'Prove a wallet is yours with a free signature and a link anyone can verify — no transaction.',
    tint: 'from-indigo-500/20 to-blue-500/5 text-indigo-600',
  },
  {
    icon: EyeOff,
    title: 'Spam token filter',
    body: 'Hides scam airdrops, fake USDC/USDT contracts and look-alike letters from your token list.',
    tint: 'from-rose-500/20 to-red-500/5 text-rose-600',
  },
  {
    icon: ScrollText,
    title: 'Transaction explainer',
    body: 'Paste any tx hash and get it in plain English — swaps, approvals, mints, failures and fees.',
    tint: 'from-violet-500/20 to-purple-500/5 text-violet-600',
    to: { view: 'tx' },
    cta: 'Explain a transaction',
  },
  {
    icon: Fuel,
    title: 'Live gas tracker',
    body: 'What a send, swap or mint costs right now on each network, updated every block.',
    tint: 'from-lime-500/20 to-green-500/5 text-lime-700',
    to: { view: 'gas' },
    cta: 'Check gas',
  },
]

export function Landing() {
  return (
    <div className="flex flex-col gap-14 py-6">
      <section className="flex flex-col items-center gap-8 text-center">
        <div>
          <p className="bg-muted text-muted-foreground mx-auto mb-4 w-fit rounded-full px-3 py-1 text-xs font-medium">
            Ethereum · Base · Sepolia
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Your wallet,{' '}
            <span className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-400 bg-clip-text text-transparent">
              with a bodyguard
            </span>
          </h1>
          <p className="text-muted-foreground mx-auto mt-3 max-w-xl">
            A dozen tools most wallets don’t have — scam protection before you sign, approval clean-up, live whale
            alerts, and a Wrapped story for any address.
          </p>
        </div>
        <div id="connect" className="w-full scroll-mt-24">
          <div className="flex justify-center">
            <ConnectCard />
          </div>
        </div>
        <button
          className="text-muted-foreground text-sm underline underline-offset-4"
          onClick={() => navigate({ view: 'view', target: 'vitalik.eth' })}
        >
          No wallet? Look inside vitalik.eth’s wallet →
        </button>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => {
          const Icon = f.icon
          return (
            <div key={f.title} className="bg-card flex flex-col gap-3 rounded-xl border p-5 text-left">
              <span className={`flex size-10 items-center justify-center rounded-lg bg-gradient-to-br ${f.tint}`}>
                <Icon className="size-5" />
              </span>
              <h2 className="font-semibold">{f.title}</h2>
              <p className="text-muted-foreground flex-1 text-sm">{f.body}</p>
              <button
                className="flex w-fit items-center gap-1 text-sm font-medium hover:underline"
                onClick={() =>
                  f.to
                    ? navigate(f.to)
                    : document.getElementById('connect')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }
              >
                {f.cta ?? 'Connect to use'} <ArrowRight className="size-4" />
              </button>
            </div>
          )
        })}
      </section>
    </div>
  )
}
