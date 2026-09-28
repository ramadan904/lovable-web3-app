import { useConnection } from 'wagmi'
import { Hexagon } from 'lucide-react'

import { ConnectButton } from '@/components/ConnectButton'
import { ConnectCard } from '@/components/ConnectCard'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ActivityCard } from '@/components/dashboard/ActivityCard'
import { Portfolio } from '@/components/dashboard/Portfolio'
import { ReceiveCard } from '@/components/dashboard/ReceiveCard'
import { SendCard } from '@/components/dashboard/SendCard'

function App() {
  const { address, status } = useConnection()
  const connected = status === 'connected' && !!address

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <span className="flex items-center gap-2 font-semibold">
            <Hexagon className="size-5" />
            Lovable Web3
          </span>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <ConnectButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        {connected ? (
          <div className="grid gap-6 md:grid-cols-2">
            <Portfolio address={address} />
            <SendCard />
            <div className="flex flex-col gap-6">
              <ReceiveCard address={address} />
              <ActivityCard address={address} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-8 py-10 text-center">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Your wallet, one screen</h1>
              <p className="text-muted-foreground mt-2">
                See ETH and USDC on Ethereum, Base and Sepolia, then send, receive and track transfers.
              </p>
            </div>
            <ConnectCard />
          </div>
        )}
      </main>

      <footer className="text-muted-foreground border-t py-6 text-center text-xs">
        Built with React, Tailwind, shadcn/ui and wagmi.
      </footer>
    </div>
  )
}

export default App
