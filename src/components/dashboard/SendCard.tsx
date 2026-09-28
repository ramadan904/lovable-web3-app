import { useState, type FormEvent } from 'react'
import { erc20Abi, isAddress, parseUnits, type Hash } from 'viem'
import {
  useChains,
  useConnection,
  useSendTransaction,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { ExternalLink, Send, TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { recordActivity, type ActivityItem } from '@/lib/activity'
import { USDC, USDC_DECIMALS } from '@/lib/tokens'
import { cn } from '@/lib/utils'

type Token = ActivityItem['token']
const TOKENS: Token[] = ['ETH', 'USDC']
const DECIMALS: Record<Token, number> = { ETH: 18, USDC: USDC_DECIMALS }

function parseAmount(value: string, decimals: number) {
  if (!/^\d*\.?\d+$|^\d+\.$/.test(value)) return null
  try {
    const units = parseUnits(value, decimals)
    return units > 0n ? units : null
  } catch {
    return null
  }
}

function errorText(error: Error) {
  return 'shortMessage' in error ? String(error.shortMessage) : error.message
}

export function SendCard() {
  const { address, chain } = useConnection()
  const chains = useChains()
  const switchChain = useSwitchChain()
  const sendEth = useSendTransaction()
  const sendToken = useWriteContract()

  const [token, setToken] = useState<Token>('ETH')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [lastHash, setLastHash] = useState<Hash>()
  const receipt = useWaitForTransactionReceipt({ hash: lastHash })

  const toValid = isAddress(to)
  const units = parseAmount(amount, DECIMALS[token])
  const pending = sendEth.isPending || sendToken.isPending
  const canSend = !!chain && !!address && toValid && units !== null && !pending
  const error = token === 'ETH' ? sendEth.error : sendToken.error

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSend || !chain || !address || !toValid || units === null) return

    const onSuccess = (hash: Hash) => {
      setLastHash(hash)
      setAmount('')
      recordActivity(address, { hash, chainId: chain.id, token, amount, to, time: Date.now() })
    }

    if (token === 'ETH') {
      sendEth.mutate({ to, value: units }, { onSuccess })
    } else {
      sendToken.mutate(
        {
          address: USDC[chain.id],
          abi: erc20Abi,
          functionName: 'transfer',
          args: [to, units],
        },
        { onSuccess },
      )
    }
  }

  const explorer = chain?.blockExplorers?.default.url
  const symbol = token === 'ETH' ? (chain?.nativeCurrency.symbol ?? 'ETH') : 'USDC'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send</CardTitle>
        <CardDescription>Send ETH or USDC from your connected wallet.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label>Network</Label>
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
        </div>

        {chain && chain.id !== sepolia.id && (
          <p className="flex items-start gap-2 rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            This sends real funds on {chain.name}. Switch to Sepolia to test for free.
          </p>
        )}

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label>Token</Label>
            <div className="bg-muted inline-flex w-fit rounded-md p-1">
              {TOKENS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setToken(t)}
                  className={cn(
                    'rounded px-4 py-1 text-sm font-medium transition-colors',
                    token === t ? 'bg-background shadow-xs' : 'text-muted-foreground',
                  )}
                  aria-pressed={token === t}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
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
            <Label htmlFor="send-amount">Amount ({symbol})</Label>
            <Input
              id="send-amount"
              inputMode="decimal"
              placeholder={token === 'ETH' ? '0.01' : '10'}
              value={amount}
              onChange={(e) => setAmount(e.target.value.trim())}
              aria-invalid={amount !== '' && units === null}
            />
            {amount !== '' && units === null && (
              <p className="text-destructive text-xs">Enter a positive number.</p>
            )}
          </div>
          <Button type="submit" disabled={!canSend}>
            <Send />
            {pending ? 'Confirm in your wallet…' : `Send ${symbol}`}
          </Button>
        </form>

        {error && <p className="text-destructive text-sm">{errorText(error)}</p>}

        {lastHash && (
          <div className="bg-muted flex flex-col gap-1 rounded-md p-3 text-sm">
            <span
              className={cn('font-medium', receipt.data?.status === 'reverted' && 'text-destructive')}
            >
              {receipt.data?.status === 'success'
                ? 'Confirmed'
                : receipt.data?.status === 'reverted'
                  ? 'Failed'
                  : 'Waiting for confirmation…'}
            </span>
            {explorer && (
              <a
                href={`${explorer}/tx/${lastHash}`}
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
