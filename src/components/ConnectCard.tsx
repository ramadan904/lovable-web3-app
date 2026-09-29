import { useConnect } from 'wagmi'
import { QrCode, Wallet } from 'lucide-react'

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
          Use a browser wallet such as MetaMask, Rabby, Brave Wallet or Coinbase Wallet
          {options.some((c) => c.type === 'walletConnect') && ', or scan a QR code with a mobile wallet'}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {options.map((connector, i) => (
          <Button
            variant={i === 0 ? 'default' : 'outline'}
            key={connector.uid}
            onClick={() => connect.mutate({ connector })}
            disabled={connect.isPending}
          >
            {connector.type === 'walletConnect' ? <QrCode /> : <Wallet />}
            {connect.isPending ? 'Connecting…' : connectorLabel(connector)}
          </Button>
        ))}
        {connect.error && <p className="text-destructive text-sm">{connect.error.message}</p>}
      </CardContent>
    </Card>
  )
}
