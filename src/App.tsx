import { useConnection } from 'wagmi'
import { Hexagon } from 'lucide-react'

import { CommandBar } from '@/components/CommandBar'
import { ConnectButton } from '@/components/ConnectButton'
import { ConnectCard } from '@/components/ConnectCard'
import { NetworkBanner } from '@/components/NetworkBanner'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ActivityCard } from '@/components/dashboard/ActivityCard'
import { Portfolio } from '@/components/dashboard/Portfolio'
import { ReceiveCard } from '@/components/dashboard/ReceiveCard'
import { RequestCard } from '@/components/dashboard/RequestCard'
import { SendCard } from '@/components/dashboard/SendCard'
import { ApprovalsView } from '@/components/approvals/ApprovalsView'
import { GasView } from '@/components/gas/GasView'
import { PayView } from '@/components/pay/PayView'
import { ProofView } from '@/components/proof/ProofView'
import { WatchView } from '@/components/watch/WatchView'
import { WrappedView } from '@/components/wrapped/WrappedView'
import { navigate, useRoute, type Route } from '@/lib/route'
import { cn } from '@/lib/utils'

const TABS: { view: Route['view']; label: string }[] = [
  { view: 'dashboard', label: 'Wallet' },
  { view: 'wrapped', label: 'Wrapped' },
  { view: 'watch', label: 'Watch' },
  { view: 'approvals', label: 'Guard' },
  { view: 'gas', label: 'Gas' },
]

function Dashboard() {
  const { address, status } = useConnection()
  if (status === 'connected' && address)
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Portfolio address={address} />
        <SendCard />
        <div className="flex flex-col gap-6">
          <ReceiveCard address={address} />
          <RequestCard address={address} />
        </div>
        <div className="md:col-span-2">
          <ActivityCard address={address} />
        </div>
      </div>
    )
  return (
    <div className="flex flex-col items-center gap-8 py-10 text-center">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Your wallet, with a bodyguard</h1>
        <p className="text-muted-foreground mx-auto mt-2 max-w-xl">
          Balances on Ethereum, Base and Sepolia, sends protected by Scam Shield, plain-English commands, and a
          Wrapped story for any wallet.
        </p>
      </div>
      <ConnectCard />
      <button
        className="text-muted-foreground text-sm underline underline-offset-4"
        onClick={() => navigate({ view: 'wrapped', target: 'vitalik.eth' })}
      >
        No wallet? See vitalik.eth’s Wallet Wrapped →
      </button>
    </div>
  )
}

function App() {
  const route = useRoute()

  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
          <div className="flex items-center gap-6">
            <button className="flex items-center gap-2 font-semibold" onClick={() => navigate({ view: 'dashboard' })}>
              <Hexagon className="size-5" />
              <span className="hidden sm:inline">Lovable Web3</span>
            </button>
            <nav className="hidden items-center gap-1 md:flex">
              {TABS.map((t) => (
                <button
                  key={t.view}
                  onClick={() => navigate({ view: t.view })}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    route.view === t.view ? 'bg-muted' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-1">
            <CommandBar />
            <ThemeToggle />
            <ConnectButton />
          </div>
        </div>
        <nav className="flex border-t md:hidden">
          {TABS.map((t) => (
            <button
              key={t.view}
              onClick={() => navigate({ view: t.view })}
              className={cn(
                'flex-1 py-2 text-sm font-medium',
                route.view === t.view ? 'border-foreground border-b-2' : 'text-muted-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <NetworkBanner />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {route.view === 'gas' ? (
          <GasView />
        ) : route.view === 'prove' || route.view === 'verify' ? (
          <ProofView key={route.params?.toString() ?? route.view} mode={route.view} params={route.params} />
        ) : route.view === 'watch' ? (
          <WatchView />
        ) : route.view === 'approvals' ? (
          <ApprovalsView />
        ) : route.view === 'pay' ? (
          <PayView key={route.params?.toString()} params={route.params} />
        ) : route.view === 'wrapped' ? (
          <WrappedView key={route.target ?? ''} target={route.target} />
        ) : (
          <Dashboard />
        )}
      </main>

      <footer className="text-muted-foreground border-t py-6 text-center text-xs">
        Press Ctrl K for commands · Built with React, Tailwind, shadcn/ui and wagmi.
      </footer>
    </div>
  )
}

export default App
