import { lazy, Suspense } from 'react'
import { useConnection } from 'wagmi'
import { Download } from 'lucide-react'

import { CommandBar } from '@/components/CommandBar'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { CurrencyPicker } from '@/components/CurrencyPicker'
import { ConnectButton } from '@/components/ConnectButton'
import { Landing } from '@/components/Landing'
import { NetworkBanner } from '@/components/NetworkBanner'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ActivityCard } from '@/components/dashboard/ActivityCard'
import { ContactsCard } from '@/components/dashboard/ContactsCard'
import { NftsCard } from '@/components/dashboard/NftsCard'
import { Portfolio } from '@/components/dashboard/Portfolio'
import { ReceiveCard } from '@/components/dashboard/ReceiveCard'
import { RequestCard } from '@/components/dashboard/RequestCard'
import { SendCard } from '@/components/dashboard/SendCard'
import { TokensCard } from '@/components/dashboard/TokensCard'
import { promptInstall, useCanInstall } from '@/lib/install'
import { useCurrency, usePrices } from '@/lib/prices'
import { navigate, useRoute, type Route } from '@/lib/route'
import { cn } from '@/lib/utils'

// Each page is its own chunk, so the first visit only downloads the wallet dashboard.
const ApprovalsView = lazy(() =>
  import('@/components/approvals/ApprovalsView').then((m) => ({ default: m.ApprovalsView })),
)
const ExplainView = lazy(() => import('@/components/explain/ExplainView').then((m) => ({ default: m.ExplainView })))
const GasView = lazy(() => import('@/components/gas/GasView').then((m) => ({ default: m.GasView })))
const PayView = lazy(() => import('@/components/pay/PayView').then((m) => ({ default: m.PayView })))
const ProofView = lazy(() => import('@/components/proof/ProofView').then((m) => ({ default: m.ProofView })))
const WatchView = lazy(() => import('@/components/watch/WatchView').then((m) => ({ default: m.WatchView })))
const LockView = lazy(() => import('@/components/lock/LockView').then((m) => ({ default: m.LockView })))
const ViewWallet = lazy(() => import('@/components/view/ViewWallet').then((m) => ({ default: m.ViewWallet })))
const WrappedView = lazy(() => import('@/components/wrapped/WrappedView').then((m) => ({ default: m.WrappedView })))

const TABS: { view: Route['view']; label: string }[] = [
  { view: 'dashboard', label: 'Wallet' },
  { view: 'wrapped', label: 'Wrapped' },
  { view: 'watch', label: 'Watch' },
  { view: 'approvals', label: 'Guard' },
  { view: 'lock', label: 'Lock' },
  { view: 'gas', label: 'Gas' },
]

function Dashboard() {
  const { address, status } = useConnection()
  if (status === 'connected' && address)
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <ErrorBoundary label="Portfolio">
          <Portfolio address={address} />
        </ErrorBoundary>
        <ErrorBoundary label="Tokens">
          <TokensCard address={address} />
        </ErrorBoundary>
        <ErrorBoundary label="NFTs">
          <NftsCard address={address} />
        </ErrorBoundary>
        <ErrorBoundary label="Send">
          <SendCard />
        </ErrorBoundary>
        <div className="flex flex-col gap-6">
          <ReceiveCard address={address} />
          <RequestCard address={address} />
        </div>
        <ErrorBoundary label="Contacts">
          <ContactsCard />
        </ErrorBoundary>
        <ErrorBoundary label="Activity">
          <ActivityCard address={address} />
        </ErrorBoundary>
      </div>
    )
  return <Landing />
}

function App() {
  const route = useRoute()
  const canInstall = useCanInstall()
  // Subscribing here re-renders the whole tree when the currency or FX rates change.
  useCurrency()
  usePrices()

  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
        <div aria-hidden className="from-brand-from via-brand-via to-brand-to h-0.5 bg-gradient-to-r" />
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 font-semibold" onClick={() => navigate({ view: 'dashboard' })}>
              <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-6" />
              <span className="hidden whitespace-nowrap xl:inline">Lovable Web3</span>
            </button>
            <nav className="hidden items-center gap-1 lg:flex">
              {TABS.map((t) => (
                <button
                  key={t.view}
                  onClick={() => navigate({ view: t.view })}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    route.view === t.view
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-1">
            <CommandBar />
            <CurrencyPicker />
            <ThemeToggle />
            <ConnectButton />
          </div>
        </div>
        <nav className="flex border-t lg:hidden">
          {TABS.map((t) => (
            <button
              key={t.view}
              onClick={() => navigate({ view: t.view })}
              className={cn(
                'flex-1 py-2 text-sm font-medium',
                route.view === t.view ? 'border-primary text-primary border-b-2' : 'text-muted-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <NetworkBanner />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <ErrorBoundary key={`${route.view}:${route.target ?? ''}`} label="This page">
          <Suspense fallback={<p className="text-muted-foreground py-20 text-center text-sm">Loading…</p>}>
            {route.view === 'gas' ? (
              <GasView />
            ) : route.view === 'lock' ? (
              <LockView />
            ) : route.view === 'view' ? (
              <ViewWallet key={route.target ?? ''} target={route.target} />
            ) : route.view === 'tx' ? (
              <ExplainView key={route.target ?? ''} hash={route.target} />
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
          </Suspense>
        </ErrorBoundary>
      </main>

      <footer className="text-muted-foreground flex flex-col items-center gap-3 border-t py-6 text-center text-xs">
        {canInstall && (
          <button
            onClick={promptInstall}
            className="bg-muted text-foreground flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
          >
            <Download className="size-4" /> Install the app
          </button>
        )}
        Press Ctrl K for commands · Built with React, Tailwind, shadcn/ui and wagmi.
      </footer>
    </div>
  )
}

export default App
