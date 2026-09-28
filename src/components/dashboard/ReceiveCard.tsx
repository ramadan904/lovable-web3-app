import { useState } from 'react'
import type { Address } from 'viem'
import { Check, Copy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function ReceiveCard({ address }: { address: Address }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard can be blocked (e.g. insecure context); the address stays selectable.
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receive</CardTitle>
        <CardDescription>
          Share this address to receive ETH or tokens on Ethereum, Base or Sepolia.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="bg-muted rounded-md p-3 font-mono text-sm break-all select-all">{address}</p>
        <Button variant="outline" onClick={copy}>
          {copied ? <Check /> : <Copy />}
          {copied ? 'Copied' : 'Copy address'}
        </Button>
        <p className="text-muted-foreground text-xs">
          Need test ETH? Search for a “Sepolia faucet”, paste this address, then switch to Sepolia.
        </p>
      </CardContent>
    </Card>
  )
}
