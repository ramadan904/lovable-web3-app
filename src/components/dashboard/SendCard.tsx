import { useState, type FormEvent } from 'react'
import { isAddress, parseEther } from 'viem'
import {
  useChains,
  useConnection,
  useSendTransaction,
  useSwitchChain,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { ExternalLink, Send, TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

function parseAmount(value: string) {
  try {
    const wei = parseEther(value)
    return wei > 0n ? wei : null
  } catch {
    return null
  }
}

export function SendCard() {
  const { chain } = useConnection()
  const chains = useChains()
  const switchChain = useSwitchChain()
  const send = useSendTransaction()
  const receipt = useWaitForTransactionReceipt({ hash: send.data })

  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')

  const toValid = isAddress(to)
  const wei = parseAmount(amount)
  const canSend = !!chain && toValid && wei !== null && !send.isPending

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSend || !toValid || wei === null) return
    send.mutate({ to, value: wei })
  }

  const explorer = chain?.blockExplorers?.default.url

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send ETH</CardTitle>
        <CardDescription>Send from your connected wallet on the selected network.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {chains.map((c) => (
            <Button
              key={c.id}
              type="button"
              size="sm"
              variant={c.id === chain?.id ? 'default' : 'outline'}
              onClick={() => switchChain.mutate({ chainId: c.id })}
              disabled={switchChain.isPending || c.id === chain?.id}
            >
              {c.name}
            </Button>
          ))}
        </div>

        {chain && chain.id !== sepolia.id && (
          <p className="flex items-start gap-2 rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            This sends real ETH on {chain.name}. Switch to Sepolia to test for free.
          </p>
        )}

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="send-to">Recipient address</Label>
            <Input
              id="send-to"
              placeholder="0x…"
              value={to}
              onChange={(e) => setTo(e.target.value.trim())}
              aria-invalid={to !== '' && !toValid}
              className="font-mono"
              autoComplete="off"
              spellCheck={false}
            />
            {to !== '' && !toValid && (
              <p className="text-destructive text-xs">That isn't a valid address.</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="send-amount">Amount ({chain?.nativeCurrency.symbol ?? 'ETH'})</Label>
            <Input
              id="send-amount"
              inputMode="decimal"
              placeholder="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value.trim())}
              aria-invalid={amount !== '' && wei === null}
            />
          </div>
          <Button type="submit" disabled={!canSend}>
            <Send />
            {send.isPending ? 'Confirm in your wallet…' : 'Send'}
          </Button>
        </form>

        {send.error && (
          <p className="text-destructive text-sm">
            {'shortMessage' in send.error ? send.error.shortMessage : send.error.message}
          </p>
        )}

        {send.data && (
          <div className="bg-muted flex flex-col gap-1 rounded-md p-3 text-sm">
            <span
              className={cn(
                'font-medium',
                receipt.data?.status === 'reverted' && 'text-destructive',
              )}
            >
              {receipt.isLoading
                ? 'Waiting for confirmation…'
                : receipt.data?.status === 'success'
                  ? 'Confirmed'
                  : receipt.data?.status === 'reverted'
                    ? 'Failed'
                    : 'Submitted'}
            </span>
            {explorer && (
              <a
                href={`${explorer}/tx/${send.data}`}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground inline-flex items-center gap-1 underline underline-offset-4"
              >
                View on explorer <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
