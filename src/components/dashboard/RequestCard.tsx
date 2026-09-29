import { useState } from 'react'
import { formatUnits, parseUnits, type Address } from 'viem'
import { useChains, useConnection } from 'wagmi'
import { QRCodeSVG } from 'qrcode.react'
import { Check, Copy, Link2, Share2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { buildPayLink } from '@/lib/payLink'
import { cn } from '@/lib/utils'
import { chainLabel } from '@/lib/chains'

function splitShare(total: string, people: number, decimals: number) {
  try {
    const units = parseUnits(total, decimals)
    const n = BigInt(Math.max(1, people))
    const each = (units + n - 1n) / n
    return each > 0n ? formatUnits(each, decimals) : undefined
  } catch {
    return undefined
  }
}

export function RequestCard({ address }: { address: Address }) {
  const chains = useChains()
  const { chain } = useConnection()
  const [chainId, setChainId] = useState<number>(chain?.id ?? chains[0].id)
  const [token, setToken] = useState<'ETH' | 'USDC'>('USDC')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [people, setPeople] = useState(1)
  const [copied, setCopied] = useState(false)

  const valid = /^\d*\.?\d+$/.test(amount) && Number(amount) > 0
  // Splitting: each person pays total ÷ people, rounded up to the token's smallest unit so you're never short.
  const perPerson = valid ? splitShare(amount, people, token === 'USDC' ? 6 : 18) : undefined
  const noteText =
    people > 1 ? `Your share of ${amount} ${token} split ${people} ways${note.trim() ? ` — ${note.trim()}` : ''}` : note
  const link = perPerson ? buildPayLink({ to: address, amount: perPerson, token, chainId, note: noteText }) : undefined
  const chainName = chains.find((c) => c.id === chainId)?.name

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable
    }
  }

  async function share() {
    if (!link) return
    const text = `Please pay me ${perPerson} ${token} on ${chainName}${note ? ` — ${note}` : ''}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Payment request', text, url: link })
      } catch {
        // user cancelled
      }
    } else copy()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="size-5" /> Request payment
        </CardTitle>
        <CardDescription>Make a link anyone can open to pay you in one tap.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="chip-row">
          {chains.map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant={c.id === chainId ? 'default' : 'outline'}
              onClick={() => setChainId(c.id)}
            >
              {chainLabel(c)}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <div className="grid gap-2">
            <Label htmlFor="req-amount">{people > 1 ? 'Total amount' : 'Amount'}</Label>
            <Input
              id="req-amount"
              inputMode="decimal"
              placeholder="25"
              value={amount}
              onChange={(e) => setAmount(e.target.value.trim())}
              aria-invalid={amount !== '' && !valid}
            />
          </div>
          <div className="bg-muted inline-flex h-9 rounded-md p-1">
            {(['USDC', 'ETH'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setToken(t)}
                aria-pressed={token === t}
                className={cn(
                  'rounded px-3 text-sm font-medium',
                  token === t ? 'bg-background shadow-xs' : 'text-muted-foreground',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="req-note">What's it for? (optional)</Label>
          <Input
            id="req-note"
            placeholder="Pizza night 🍕"
            maxLength={80}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Label htmlFor="req-people">Split between</Label>
          <Input
            id="req-people"
            type="number"
            min={1}
            max={50}
            className="w-20"
            value={people}
            onChange={(e) => setPeople(Math.min(50, Math.max(1, Math.floor(Number(e.target.value) || 1))))}
          />
          <span className="text-muted-foreground">{people === 1 ? 'person (just one payer)' : 'people'}</span>
          {people > 1 && perPerson && (
            <span className="bg-muted rounded-full px-2.5 py-0.5 text-xs font-medium">
              Each pays {perPerson} {token}
            </span>
          )}
        </div>

        {link ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border p-4">
            <div className="rounded-lg bg-white p-2">
              <QRCodeSVG value={link} size={140} bgColor="#ffffff" fgColor="#000000" />
            </div>
            <p className="text-muted-foreground w-full truncate text-center font-mono text-xs">{link}</p>
            <div className="flex w-full gap-2">
              <Button className="flex-1" variant="outline" onClick={copy}>
                {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy link'}
              </Button>
              <Button className="flex-1" onClick={share}>
                <Share2 /> Share
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">
            Enter an amount (the total, if you’re splitting) to generate your link and QR code.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
