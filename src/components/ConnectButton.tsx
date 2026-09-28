import { useConnect, useConnection, useDisconnect, useEnsName } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { LogOut, Wallet } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { shortenAddress } from '@/lib/utils'
import { useWalletOptions } from '@/lib/wallet'

/** Compact connect / account control for the header. */
export function ConnectButton() {
  const { address, status } = useConnection()
  const { data: ensName } = useEnsName({ address, chainId: mainnet.id })
  const options = useWalletOptions()
  const connect = useConnect()
  const disconnect = useDisconnect()

  if (status === 'connected' && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="bg-muted rounded-full px-3 py-1.5 font-mono text-sm">
          {ensName ?? shortenAddress(address)}
        </span>
        <Button variant="ghost" size="icon" onClick={() => disconnect.mutate()} aria-label="Disconnect">
          <LogOut />
        </Button>
      </div>
    )
  }

  const first = options[0]
  return (
    <Button
      size="sm"
      onClick={() => first && connect.mutate({ connector: first })}
      disabled={!first || connect.isPending}
    >
      <Wallet />
      {connect.isPending ? 'Connecting…' : 'Connect'}
    </Button>
  )
}
