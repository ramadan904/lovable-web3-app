import { WalletCard } from '@/components/WalletCard'

function App() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Lovable Web3 App</h1>
        <p className="text-muted-foreground mt-2">
          React, Tailwind, shadcn/ui and wagmi, ready to build on.
        </p>
      </div>
      <WalletCard />
    </main>
  )
}

export default App
