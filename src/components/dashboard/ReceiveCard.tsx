import { useState } from 'react'
import type { Address } from 'viem'
import { QRCodeSVG } from 'qrcode.react'
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
    <Card id="receive" className="scroll-mt-20">
      <CardHeader>
        <CardTitle>Receive</CardTitle>
        <CardDescription>
          Scan or share this address to receive ETH or USDC on Ethereum, Base or Sepolia.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        {/* Always dark-on-white so wallets can scan it in either theme. */}
        <div className="rounded-lg bg-white p-3">
          <QRCodeSVG value={address} size={160} bgColor="#ffffff" fgColor="#000000" />
        </div>
        <p className="bg-muted w-full rounded-md p-3 text-center font-mono text-sm break-all select-all">
          {address}
        </p>
        <Button variant="outline" className="w-full" onClick={copy}>
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
