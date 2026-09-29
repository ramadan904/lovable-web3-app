import { useEffect, useRef, useState, type FormEvent } from 'react'
import { encodeDeployData, encodeFunctionData, formatEther, isAddress, parseEther, type Address, type Hash } from 'viem'
import {
  useBalance,
  useChains,
  useConnection,
  useDeployContract,
  useSendTransaction,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { readContract } from 'wagmi/actions'
import { sepolia } from 'wagmi/chains'
import { ExternalLink, FileCode2, Lock, LockOpen, PiggyBank, Plus, TriangleAlert, X } from 'lucide-react'

import { ConnectCard } from '@/components/ConnectCard'
import { ReviewDialog } from '@/components/review/ReviewDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatFiat, usePrices } from '@/lib/prices'
import {
  countdown,
  forgetVault,
  MAX_LOCK_SECONDS,
  rememberVault,
  savingsLockAbi,
  savingsLockBytecode,
  SOURCE_URL,
  useVaults,
  type Vault,
} from '@/lib/savingsLock'
import { cn, formatAmount } from '@/lib/utils'
import { config, type ChainId } from '@/lib/wagmi'
import { celebrate } from '@/lib/celebrate'

const errText = (e: Error) => ('shortMessage' in e ? String(e.shortMessage) : e.message)
const isoDate = (d: Date) => d.toISOString().slice(0, 10)

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

function CreateLock({ owner }: { owner: Address }) {
  const chains = useChains()
  const { chain } = useConnection()
  const switchChain = useSwitchChain()
  const deploy = useDeployContract()
  const [chainId, setChainId] = useState<ChainId>(sepolia.id)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [ack, setAck] = useState(false)
  const [hash, setHash] = useState<Hash>()
  const [reviewing, setReviewing] = useState(false)
  const receipt = useWaitForTransactionReceipt({ hash, chainId })
  const now = useNow(30_000)

  const target = chains.find((c) => c.id === chainId)!
  const unlock = date ? Math.floor(new Date(`${date}T09:00`).getTime() / 1000) : undefined
  const unlockOk = unlock !== undefined && unlock > now + 60 && unlock < now + MAX_LOCK_SECONDS - 60
  let value: bigint | undefined
  try {
    value = amount === '' ? 0n : parseEther(amount)
  } catch {
    value = undefined
  }
  const realMoney = !target.testnet
  const onChain = chain?.id === chainId
  const busy = deploy.isPending || (!!hash && receipt.isLoading)
  const created = receipt.data?.status === 'success'
  const canCreate = unlockOk && value !== undefined && onChain && (!realMoney || ack) && !busy && !created

  // Remember the vault as soon as its deployment is mined (and celebrate once per deployment).
  const celebrated = useRef<string | undefined>(undefined)
  useEffect(() => {
    const address = receipt.data?.contractAddress
    if (receipt.data?.status === 'success' && address && unlock) {
      if (celebrated.current !== receipt.data.transactionHash) {
        celebrated.current = receipt.data.transactionHash
        celebrate('big')
      }
      rememberVault({
        address,
        chainId,
        owner,
        unlockTime: unlock,
        name: name.trim() || 'Savings',
        createdAt: Math.floor(Date.now() / 1000),
      })
    }
  }, [receipt.data, chainId, owner, unlock, name])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (canCreate) setReviewing(true)
  }

  function confirmCreate() {
    if (!canCreate || unlock === undefined || value === undefined) return
    deploy.mutate(
      { abi: savingsLockAbi, bytecode: savingsLockBytecode, args: [BigInt(unlock)], value, chainId },
      {
        onSuccess: (h) => {
          setReviewing(false)
          setHash(h)
        },
      },
    )
  }

  const today = new Date()
  const min = isoDate(new Date(today.getTime() + 86_400_000))
  const max = isoDate(new Date(today.getTime() + (MAX_LOCK_SECONDS - 2 * 86_400) * 1000))
  const days = unlock ? Math.ceil((unlock - now) / 86_400) : undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PiggyBank className="size-5" /> New savings lock
        </CardTitle>
        <CardDescription>
          Deploys your own tiny contract. Nobody — not even you — can take the ETH out before the date you pick.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {chains.map((c) => (
              <Button
                key={c.id}
                type="button"
                size="sm"
                variant={c.id === chainId ? 'default' : 'outline'}
                onClick={() => {
                  setChainId(c.id)
                  setAck(false)
                }}
              >
                {c.name}
                {c.testnet && ' (test)'}
              </Button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="lock-name">What are you saving for?</Label>
              <Input
                id="lock-name"
                placeholder="School fees"
                maxLength={40}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lock-amount">Amount to lock now (ETH)</Label>
              <Input
                id="lock-amount"
                inputMode="decimal"
                placeholder="0.05 (or top up later)"
                value={amount}
                onChange={(e) => setAmount(e.target.value.trim())}
                aria-invalid={value === undefined}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lock-date">Unlocks on (9:00 your time)</Label>
              <Input
                id="lock-date"
                type="date"
                min={min}
                max={max}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          {unlock && unlockOk && (
            <p className="bg-muted rounded-md p-3 text-sm">
              Locked for{' '}
              <strong>
                {days} day{days === 1 ? '' : 's'}
              </strong>
              , until <strong>{new Date(unlock * 1000).toLocaleString()}</strong>. Anyone can add to it; only you can
              withdraw, and only after that.
            </p>
          )}
          {date && !unlockOk && (
            <p className="text-destructive text-xs">Pick a date between tomorrow and 5 years from now.</p>
          )}

          {realMoney && (
            <label className="flex items-start gap-2 rounded-md bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
              <input type="checkbox" className="mt-0.5" checked={ack} onChange={(e) => setAck(e.target.checked)} />
              <span>
                This locks <strong>real ETH on {target.name}</strong>. I understand I can’t get it back before the
                unlock date, and that this small contract is open-source but not professionally audited. (Try Sepolia
                first!)
              </span>
            </label>
          )}

          {!onChain ? (
            <Button type="button" onClick={() => switchChain.mutate({ chainId })} disabled={switchChain.isPending}>
              Switch wallet to {target.name}
            </Button>
          ) : (
            <Button type="submit" disabled={!canCreate}>
              <Lock />
              {deploy.isPending
                ? 'Confirm in your wallet…'
                : hash && receipt.isLoading
                  ? 'Creating your lock…'
                  : created
                    ? 'Lock created ✓'
                    : receipt.isError
                      ? 'Try again'
                      : 'Create lock'}
            </Button>
          )}
          {deploy.error && <p className="text-destructive text-sm">{errText(deploy.error)}</p>}
          {receipt.isError && (
            <p className="text-destructive text-sm">
              Creating the lock failed on-chain — nothing was locked; only the network fee was spent.
            </p>
          )}
          <a
            href={SOURCE_URL}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground inline-flex w-fit items-center gap-1 text-xs underline underline-offset-4"
          >
            <FileCode2 className="size-3.5" /> Read the 40-line contract
          </a>
        </form>
        {unlock !== undefined && value !== undefined && (
          <ReviewDialog
            open={reviewing}
            onClose={() => setReviewing(false)}
            onConfirm={confirmCreate}
            title="Review new savings lock"
            summary={
              <p>
                Lock <b className="tabular-nums">{formatEther(value)} ETH</b> until{' '}
                <b>{new Date(unlock * 1000).toLocaleString()}</b>
                <span className="text-muted-foreground mt-1 block text-xs">
                  Deploys your own SavingsLock contract. Nobody can withdraw before that date — including you.
                </span>
              </p>
            }
            chainId={chainId}
            account={owner}
            calls={[
              {
                data: encodeDeployData({ abi: savingsLockAbi, bytecode: savingsLockBytecode, args: [BigInt(unlock)] }),
                value,
              },
            ]}
            confirmLabel="Create in wallet"
            pending={deploy.isPending}
            error={deploy.error ? errText(deploy.error) : undefined}
          />
        )}
      </CardContent>
    </Card>
  )
}

function VaultCard({ v }: { v: Vault }) {
  const chains = useChains()
  const { chain } = useConnection()
  const switchChain = useSwitchChain()
  const prices = usePrices()
  const now = useNow()
  const balance = useBalance({ address: v.address, chainId: v.chainId as ChainId, query: { refetchInterval: 30_000 } })
  const topUp = useSendTransaction()
  const withdraw = useWriteContract()
  const { address: account } = useConnection()
  const [amount, setAmount] = useState('')
  const [lastHash, setLastHash] = useState<Hash>()
  const [review, setReview] = useState<'topUp' | 'withdraw'>()
  const receipt = useWaitForTransactionReceipt({ hash: lastHash, chainId: v.chainId as ChainId })
  const { refetch } = balance
  useEffect(() => {
    if (!receipt.data) return
    refetch()
    if (
      receipt.data.status === 'success' &&
      receipt.data.to?.toLowerCase() === v.address.toLowerCase() &&
      withdraw.data === receipt.data.transactionHash
    )
      celebrate('big')
  }, [receipt.data, refetch, v.address, withdraw.data])

  const c = chains.find((x) => x.id === v.chainId)
  const left = v.unlockTime - now
  const unlocked = left <= 0
  const progress = Math.min(100, Math.max(0, ((now - v.createdAt) / Math.max(1, v.unlockTime - v.createdAt)) * 100))
  const eth = balance.data ? Number(formatEther(balance.data.value)) : undefined
  const onChain = chain?.id === v.chainId
  let topUpValue: bigint | undefined
  try {
    topUpValue = amount ? parseEther(amount) : undefined
  } catch {
    topUpValue = undefined
  }

  return (
    <Card className={cn(unlocked && 'ring-2 ring-emerald-500')}>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="grid gap-1.5">
          <CardTitle className="flex items-center gap-2">
            {unlocked ? <LockOpen className="size-5 text-emerald-600" /> : <Lock className="size-5" />} {v.name}
          </CardTitle>
          <CardDescription>
            {c?.name ?? `Chain ${v.chainId}`} ·{' '}
            {c?.blockExplorers?.default.url ? (
              <a
                href={`${c.blockExplorers.default.url}/address/${v.address}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 underline underline-offset-4"
              >
                contract <ExternalLink className="size-3" />
              </a>
            ) : (
              v.address
            )}
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Hide ${v.name} from this list`}
          onClick={() => forgetVault(v.address, v.chainId)}
        >
          <X />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <p className="text-3xl font-bold tabular-nums">{eth !== undefined ? `${formatAmount(eth, 6)} ETH` : '…'}</p>
          {eth !== undefined && prices.data && !c?.testnet && (
            <p className="text-muted-foreground text-sm">{formatFiat(eth * prices.data.eth)}</p>
          )}
        </div>
        <div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className={cn('h-full rounded-full', unlocked ? 'bg-emerald-500' : 'bg-violet-500')}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-muted-foreground mt-1.5 text-xs">
            {unlocked ? 'Unlocked since ' : 'Unlocks in '}
            <strong className="text-foreground">
              {unlocked ? new Date(v.unlockTime * 1000).toLocaleString() : countdown(left)}
            </strong>
            {!unlocked && ` · ${new Date(v.unlockTime * 1000).toLocaleDateString()}`}
          </p>
        </div>

        {!onChain ? (
          <Button variant="outline" onClick={() => switchChain.mutate({ chainId: v.chainId as ChainId })}>
            Switch to {c?.name} to manage
          </Button>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input
                inputMode="decimal"
                placeholder="Add ETH"
                value={amount}
                onChange={(e) => setAmount(e.target.value.trim())}
                aria-label="Top-up amount"
              />
              <Button variant="outline" disabled={!topUpValue || topUp.isPending} onClick={() => setReview('topUp')}>
                <Plus /> Top up
              </Button>
            </div>
            <Button disabled={!unlocked || withdraw.isPending || !eth} onClick={() => setReview('withdraw')}>
              {unlocked ? <LockOpen /> : <Lock />}
              {withdraw.isPending
                ? 'Confirm in your wallet…'
                : unlocked
                  ? 'Withdraw everything'
                  : `Locked for ${countdown(left)}`}
            </Button>
          </div>
        )}
        {(topUp.error || withdraw.error) && (
          <p className="text-destructive text-xs">{errText((topUp.error ?? withdraw.error)!)}</p>
        )}
        {lastHash && receipt.isLoading && <p className="text-muted-foreground text-xs">Waiting for confirmation…</p>}
        {account && (
          <ReviewDialog
            open={!!review && (review === 'withdraw' || !!topUpValue)}
            onClose={() => setReview(undefined)}
            onConfirm={() => {
              const onSuccess = (h: Hash) => {
                setReview(undefined)
                setLastHash(h)
                setAmount('')
              }
              if (review === 'topUp' && topUpValue)
                topUp.mutate({ to: v.address, value: topUpValue, chainId: v.chainId as ChainId }, { onSuccess })
              else if (review === 'withdraw')
                withdraw.mutate(
                  { address: v.address, abi: savingsLockAbi, functionName: 'withdraw', chainId: v.chainId as ChainId },
                  { onSuccess },
                )
            }}
            title={review === 'withdraw' ? 'Review withdrawal' : 'Review top-up'}
            summary={
              review === 'withdraw' ? (
                <p>
                  Withdraw everything from <b>{v.name}</b> back to your wallet
                </p>
              ) : (
                <p>
                  Add <b className="tabular-nums">{amount} ETH</b> to <b>{v.name}</b> — locked until{' '}
                  {new Date(v.unlockTime * 1000).toLocaleDateString()}
                </p>
              )
            }
            chainId={v.chainId}
            account={account}
            calls={
              review === 'withdraw'
                ? [{ to: v.address, data: encodeFunctionData({ abi: savingsLockAbi, functionName: 'withdraw' }) }]
                : [{ to: v.address, value: topUpValue ?? 0n }]
            }
            expected={review === 'topUp' ? [{ token: 'native', amount: topUpValue ?? 0n, to: v.address }] : []}
            confirmLabel={review === 'withdraw' ? 'Withdraw in wallet' : 'Top up in wallet'}
            pending={topUp.isPending || withdraw.isPending}
            error={(topUp.error ?? withdraw.error) ? errText((topUp.error ?? withdraw.error)!) : undefined}
          />
        )}
        {lastHash && receipt.isError && <p className="text-destructive text-xs">That transaction failed on-chain.</p>}
      </CardContent>
    </Card>
  )
}

function AddExisting({ owner }: { owner: Address }) {
  const chains = useChains()
  const [chainId, setChainId] = useState<ChainId>(sepolia.id)
  const [address, setAddress] = useState('')
  const [msg, setMsg] = useState<string>()

  async function onAdd(e: FormEvent) {
    e.preventDefault()
    if (!isAddress(address)) return setMsg('Enter a contract address.')
    try {
      const [o, unlock] = await Promise.all([
        readContract(config, { address, abi: savingsLockAbi, functionName: 'owner', chainId }),
        readContract(config, { address, abi: savingsLockAbi, functionName: 'unlockTime', chainId }),
      ])
      if (o.toLowerCase() !== owner.toLowerCase()) return setMsg('That lock belongs to a different wallet.')
      rememberVault({
        address,
        chainId,
        owner,
        unlockTime: Number(unlock),
        name: 'Savings',
        createdAt: Math.floor(Date.now() / 1000),
      })
      setMsg('Added ✓')
      setAddress('')
    } catch {
      setMsg('That address isn’t a savings lock on this network.')
    }
  }

  return (
    <form onSubmit={onAdd} className="flex flex-col gap-2 text-sm">
      <p className="text-muted-foreground">Created a lock on another device? Add it by address:</p>
      <div className="flex flex-wrap gap-2">
        <select
          value={chainId}
          onChange={(e) => setChainId(Number(e.target.value) as ChainId)}
          className="border-input h-9 rounded-md border bg-transparent px-2"
          aria-label="Network"
        >
          {chains.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Input
          value={address}
          onChange={(e) => setAddress(e.target.value.trim())}
          placeholder="0x…"
          className="min-w-0 flex-1 font-mono"
          aria-label="Lock contract address"
        />
        <Button type="submit" variant="outline">
          Add
        </Button>
      </div>
      {msg && <p className="text-muted-foreground text-xs">{msg}</p>}
    </form>
  )
}

export function LockView() {
  const { address, status } = useConnection()
  const vaults = useVaults(address)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <PiggyBank className="text-primary size-6" /> Savings Lock
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          A time-locked piggy bank on the blockchain. Great for “don’t touch this until…” savings — your own contract,
          no middleman, no fees beyond gas.
        </p>
      </div>
      {status !== 'connected' || !address ? (
        <div className="flex justify-center">
          <ConnectCard />
        </div>
      ) : (
        <>
          {vaults.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2">
              {vaults.map((v) => (
                <VaultCard key={`${v.chainId}:${v.address}`} v={v} />
              ))}
            </div>
          )}
          <CreateLock owner={address} />
          <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
            <TriangleAlert className="mt-px size-4 shrink-0" />
            Locks are real smart contracts. If you lose access to this wallet, the money stays locked forever — keep
            your recovery phrase safe.
          </p>
          <AddExisting owner={address} />
        </>
      )}
    </div>
  )
}
