import { useConnect } from 'wagmi'
import { Wallet } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { connectorLabel, useWalletOptions } from '@/lib/wallet'

export function ConnectCard() {
  const options = useWalletOptions()
  const connect = useConnect()

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Connect a wallet</CardTitle>
        <CardDescription>
          Use a browser wallet such as MetaMask, Rabby, Brave Wallet or Coinbase Wallet.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {options.map((connector) => (
          <Button
            key={connector.uid}
            onClick={() => connect.mutate({ connector })}
            disabled={connect.isPending}
          >
            <Wallet />
            {connect.isPending ? 'Connecting…' : connectorLabel(connector)}
          </Button>
        ))}
        {connect.error && <p className="text-destructive text-sm">{connect.error.message}</p>}
      </CardContent>
    </Card>
  )
}
