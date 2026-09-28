import { formatUnits } from 'viem'
import {
  useBalance,
  useChains,
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
  useSwitchChain,
} from 'wagmi'
import { LogOut, Wallet } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { shortenAddress } from '@/lib/utils'

export function WalletCard() {
  const { address, chain, status } = useConnection()
  const connectors = useConnectors()
  const chains = useChains()
  const connect = useConnect()
  const disconnect = useDisconnect()
  const switchChain = useSwitchChain()
  const balance = useBalance({ address })

  // Wallets announced via EIP-6963 show up by name; keep the generic
  // injected connector only as a fallback when none are detected.
  const detected = connectors.filter((c) => c.id !== 'injected')
  const options = detected.length > 0 ? detected : connectors

  if (status !== 'connected' || !address) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Connect a wallet</CardTitle>
          <CardDescription>
            Use a browser wallet such as MetaMask, Rabby or Coinbase Wallet.
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
              {connect.isPending ? 'Connecting…' : connector.id === 'injected' ? 'Connect browser wallet' : `Connect ${connector.name}`}
            </Button>
          ))}
          {connect.error && (
            <p className="text-destructive text-sm">{connect.error.message}</p>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="font-mono">{shortenAddress(address)}</CardTitle>
        <CardDescription>{chain ? `Connected to ${chain.name}` : 'Unsupported network'}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="bg-muted rounded-lg p-4">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">Balance</p>
          <p className="text-2xl font-semibold tabular-nums">
            {balance.data
              ? `${Number(formatUnits(balance.data.value, balance.data.decimals)).toFixed(4)} ${balance.data.symbol}`
              : '—'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {chains.map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant={c.id === chain?.id ? 'default' : 'outline'}
              onClick={() => switchChain.mutate({ chainId: c.id })}
              disabled={switchChain.isPending || c.id === chain?.id}
            >
              {c.name}
            </Button>
          ))}
        </div>
        <Button variant="ghost" onClick={() => disconnect.mutate()}>
          <LogOut />
          Disconnect
        </Button>
      </CardContent>
    </Card>
  )
}
