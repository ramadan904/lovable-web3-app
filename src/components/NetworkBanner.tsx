import { useChains, useConnection, useSwitchChain } from 'wagmi'
import { TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'

/** Shown when the wallet is on a network this app doesn't support. */
export function NetworkBanner() {
  const { chain, status } = useConnection()
  const chains = useChains()
  const switchChain = useSwitchChain()

  if (status !== 'connected' || chain) return null

  return (
    <div className="border-b bg-amber-500/10">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
        <TriangleAlert className="size-4 shrink-0" />
        <span className="flex-1">Your wallet is on a network this app doesn't support.</span>
        <div className="flex flex-wrap gap-2">
          {chains.map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant="outline"
              onClick={() => switchChain.mutate({ chainId: c.id })}
              disabled={switchChain.isPending}
            >
              Switch to {c.name}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
