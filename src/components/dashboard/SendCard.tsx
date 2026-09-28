import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { encodeFunctionData, erc20Abi, formatUnits, isAddress, parseUnits, type Address, type Hash } from 'viem'
import { normalize } from 'viem/ens'
import {
  useChains,
  useConnection,
  useEnsAddress,
  useEstimateFeesPerGas,
  useEstimateGas,
  useSendTransaction,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { ExternalLink, Send, TriangleAlert } from 'lucide-react'

import { ShieldPanel } from '@/components/dashboard/ShieldPanel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { recordActivity, useActivity, type ActivityItem } from '@/lib/activity'
import { useBalances } from '@/lib/balances'
import { formatFiat, usePrices } from '@/lib/prices'
import { findContact, useContacts } from '@/lib/contacts'
import { useSendDraft } from '@/lib/sendDraft'
import { useRecipientShield } from '@/lib/shield'
import { USDC, USDC_DECIMALS } from '@/lib/tokens'
import { cn, formatAmount, shortenAddress } from '@/lib/utils'
import { celebrate } from '@/lib/celebrate'

type Token = ActivityItem['token']
const TOKENS: Token[] = ['ETH', 'USDC']
const DECIMALS: Record<Token, number> = { ETH: 18, USDC: USDC_DECIMALS }
// Used when the node can't estimate (e.g. amount exceeds balance).
const FALLBACK_GAS: Record<Token, bigint> = { ETH: 21_000n, USDC: 65_000n }

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

function safeNormalize(name: string) {
  try {
    return normalize(name)
  } catch {
    return undefined
  }
}

type Initial = { to: string; amount: string; token: Token; chainId?: number }

export function SendCard({ initial, title = 'Send' }: { initial?: Initial; title?: string } = {}) {
  const { address, chain } = useConnection()
  const chains = useChains()
  const switchChain = useSwitchChain()
  const sendEth = useSendTransaction()
  const sendToken = useWriteContract()
  const queryClient = useQueryClient()
  const prices = usePrices()

  const [token, setToken] = useState<Token>(initial?.token ?? 'ETH')
  const [toInput, setToInput] = useState(initial?.to ?? '')
  const [amount, setAmount] = useState(initial?.amount ?? '')
  const [acknowledged, setAcknowledged] = useState(false)
  const [lastHash, setLastHash] = useState<Hash>()
  const receipt = useWaitForTransactionReceipt({ hash: lastHash })

  // Pre-fill from the command bar.
  const draft = useSendDraft()
  const [appliedSeq, setAppliedSeq] = useState(draft.seq)
  if (draft.seq !== appliedSeq) {
    setAppliedSeq(draft.seq)
    if (draft.token) setToken(draft.token)
    if (draft.to !== undefined) setToInput(draft.to)
    if (draft.amount !== undefined) setAmount(draft.amount)
  }

  // Recipient: a 0x address or an ENS name (resolved on Ethereum mainnet).
  // Recipient: a 0x address, a saved contact nickname, or an ENS name (resolved on Ethereum mainnet).
  const contacts = useContacts()
  const contact = !isAddress(toInput) && toInput ? findContact(toInput) : undefined
  const ensName = !isAddress(toInput) && !contact && toInput.includes('.') ? safeNormalize(toInput) : undefined
  const ens = useEnsAddress({ name: ensName, chainId: mainnet.id, query: { enabled: !!ensName } })
  const to: Address | undefined = isAddress(toInput) ? toInput : (contact?.address ?? ens.data ?? undefined)

  const { balances } = useBalances(address)
  const fees = useEstimateFeesPerGas({ chainId: chain?.id })
  const current = balances.find((b) => b.chainId === chain?.id)
  const available = token === 'ETH' ? current?.eth : current?.usdc
  const units = parseAmount(amount, DECIMALS[token])

  // Scam Shield
  const history = useActivity(address ?? '0x')
  const known = useMemo(
    () => [...new Set([...history.map((h) => h.to), ...contacts.map((c) => c.address)])],
    [history, contacts],
  )
  const shield = useRecipientShield({
    contacts,
    to,
    chainId: chain?.id,
    chainName: chain?.name,
    token,
    self: address,
    known,
  })
  const danger = shield.findings.some((f) => f.level === 'danger')
  // A new recipient or network needs a fresh acknowledgement.
  const ackKey = `${to}:${chain?.id}`
  const [ackFor, setAckFor] = useState(ackKey)
  if (ackFor !== ackKey) {
    setAckFor(ackKey)
    setAcknowledged(false)
  }

  // Fee preview
  const gas = useEstimateGas({
    account: address,
    chainId: chain?.id,
    ...(token === 'ETH'
      ? { to, value: units ?? 0n }
      : {
          to: chain ? USDC[chain.id] : undefined,
          data: to
            ? encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [to, units ?? 0n] })
            : undefined,
        }),
    query: { enabled: !!address && !!to && !!chain },
  })
  const feePerGas = fees.data?.maxFeePerGas ?? fees.data?.gasPrice
  const feeWei = feePerGas !== undefined ? (gas.data ?? FALLBACK_GAS[token]) * feePerGas : undefined
  const feeEth = feeWei !== undefined ? Number(formatUnits(feeWei, 18)) : undefined
  const feeText =
    feeEth !== undefined
      ? `${formatAmount(feeEth, 6)} ETH${prices.data && !chain?.testnet ? ` (${formatFiat(feeEth * prices.data.eth)})` : ''}`
      : undefined
  const remainingText =
    available !== undefined && units !== null && units <= available
      ? `${formatAmount(Number(formatUnits(available - units, DECIMALS[token])))} ${token}`
      : undefined

  useEffect(() => {
    if (receipt.data?.status !== 'success') return
    queryClient.invalidateQueries()
    celebrate()
  }, [receipt.data?.status, queryClient])

  function fillMax() {
    if (available === undefined) return
    let max = available
    if (token === 'ETH') {
      // Leave room for the network fee of a plain transfer (21,000 gas), with 20% headroom.
      if (feePerGas === undefined) return
      max -= (feePerGas * 21_000n * 12n) / 10n
    }
    setAmount(max > 0n ? formatUnits(max, DECIMALS[token]) : '0')
  }

  // Payment requests pin the network; never let the payer send on a different one.
  const wrongChain = initial?.chainId !== undefined && chain?.id !== initial.chainId
  const pending = sendEth.isPending || sendToken.isPending
  const overBalance = units !== null && available !== undefined && units > available
  const canSend =
    !!chain &&
    !!address &&
    !!to &&
    units !== null &&
    !overBalance &&
    !pending &&
    !wrongChain &&
    (!danger || acknowledged)
  const error = token === 'ETH' ? sendEth.error : sendToken.error

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSend || !chain || !address || !to || units === null) return

    const onSuccess = (hash: Hash) => {
      setLastHash(hash)
      setAmount('')
      recordActivity(address, { hash, chainId: chain.id, token, amount, to, time: Date.now() })
    }

    if (token === 'ETH') {
      sendEth.mutate({ to, value: units }, { onSuccess })
    } else {
      sendToken.mutate(
        { address: USDC[chain.id], abi: erc20Abi, functionName: 'transfer', args: [to, units] },
        { onSuccess },
      )
    }
  }

  const explorer = chain?.blockExplorers?.default.url
  const symbol = token === 'ETH' ? (chain?.nativeCurrency.symbol ?? 'ETH') : 'USDC'

  return (
    <Card id="send" className="scroll-mt-20">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Send ETH or USDC. Every recipient is checked by Scam Shield first.</CardDescription>
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
            <Label htmlFor="send-to">Recipient (address, contact or ENS name)</Label>
            <Input
              id="send-to"
              placeholder="0x…, a contact, or name.eth"
              value={toInput}
              onChange={(e) => setToInput(e.target.value.trim())}
              aria-invalid={toInput !== '' && !to && !ens.isLoading}
              className="font-mono"
              autoComplete="off"
              spellCheck={false}
            />
            {contacts.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {contacts.slice(0, 8).map((c) => (
                  <button
                    key={c.address}
                    type="button"
                    onClick={() => setToInput(c.name)}
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-xs',
                      contact?.address === c.address ? 'bg-foreground text-background' : 'hover:bg-muted',
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
            {contact && (
              <p className="text-muted-foreground text-xs">
                {contact.name} → <span className="font-mono">{shortenAddress(contact.address)}</span>
              </p>
            )}
            {ensName && ens.isLoading && <p className="text-muted-foreground text-xs">Looking up {ensName}…</p>}
            {ensName && to && (
              <p className="text-muted-foreground text-xs">
                {ensName} → <span className="font-mono">{shortenAddress(to)}</span>
              </p>
            )}
            {toInput !== '' && !to && !ens.isLoading && (
              <p className="text-destructive text-xs">
                {ensName
                  ? `${ensName} doesn't point to an address.`
                  : "That isn't a valid address, contact or ENS name."}
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="send-amount">Amount ({symbol})</Label>
              {available !== undefined && (
                <span className="text-muted-foreground flex items-center gap-2 text-xs">
                  Balance: {formatAmount(Number(formatUnits(available, DECIMALS[token])))}
                  <button
                    type="button"
                    onClick={fillMax}
                    className="text-foreground font-medium underline underline-offset-4"
                  >
                    Max
                  </button>
                </span>
              )}
            </div>
            <Input
              id="send-amount"
              inputMode="decimal"
              placeholder={token === 'ETH' ? '0.01' : '10'}
              value={amount}
              onChange={(e) => setAmount(e.target.value.trim())}
              aria-invalid={amount !== '' && (units === null || overBalance)}
            />
            {amount !== '' && units === null && <p className="text-destructive text-xs">Enter a positive number.</p>}
            {overBalance && <p className="text-destructive text-xs">That's more than your balance.</p>}
          </div>

          {to && (
            <ShieldPanel findings={shield.findings} loading={shield.loading} fee={feeText} remaining={remainingText} />
          )}
          {danger && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
              />
              I understand the risk and still want to send to this address.
            </label>
          )}

          {wrongChain && (
            <p className="text-destructive text-sm">
              This request is for {chains.find((c) => c.id === initial?.chainId)?.name}. Switch networks to pay.
            </p>
          )}
          <Button type="submit" disabled={!canSend} variant={danger ? 'destructive' : 'default'}>
            <Send />
            {pending ? 'Confirm in your wallet…' : `Send ${symbol}`}
          </Button>
        </form>

        {error && <p className="text-destructive text-sm">{errorText(error)}</p>}

        {lastHash && (
          <div className="bg-muted flex flex-col gap-1 rounded-md p-3 text-sm">
            {/* wagmi reports a reverted transaction as a query error, not as data */}
            <span className={cn('font-medium', receipt.isError && 'text-destructive')}>
              {receipt.data?.status === 'success'
                ? 'Confirmed'
                : receipt.isError
                  ? 'Failed — the transaction reverted. Only the network fee was spent.'
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
