import { formatUnits, type Address } from 'viem'
import {
  ArrowDownLeft,
  ArrowUpRight,
  FlaskConical,
  Fuel,
  KeyRound,
  Loader,
  ShieldCheck,
  ShieldX,
  TriangleAlert,
} from 'lucide-react'

import { useContacts } from '@/lib/contacts'
import { formatFiat } from '@/lib/prices'
import {
  surprises,
  UNLIMITED,
  type ApprovalChange,
  type ExpectedOut,
  type Movement,
  type Simulation,
} from '@/lib/simulate'
import { cn, formatAmount, shortenAddress } from '@/lib/utils'

const same = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase()

function amountText(m: { amount: bigint; token: Movement['token']; nft?: boolean }) {
  if (m.nft) return `NFT #${m.amount.toString().slice(0, 12)} (${m.token.symbol})`
  return `${formatAmount(Number(formatUnits(m.amount, m.token.decimals)), 6)} ${m.token.symbol}`
}

function approvalText(a: ApprovalChange, who: string) {
  if (a.revoke) return `Removes ${who}’s permission to use your ${a.token.symbol}`
  if (a.amount === 'all') return `Gives ${who} control of ALL your ${a.token.symbol} NFTs`
  if (a.amount >= UNLIMITED) return `Gives ${who} UNLIMITED access to your ${a.token.symbol}`
  return `Lets ${who} spend up to ${amountText({ amount: a.amount, token: a.token })}`
}

type Props = {
  sim?: Simulation
  loading: boolean
  chainName?: string
  /** Fee per gas in wei, for the fee line. */
  feePerGas?: bigint
  /** USD price of the chain's native coin (undefined on testnets). */
  nativeUsd?: number
  nativeSymbol?: string
  expected?: ExpectedOut[]
}

/** Plain-English result of simulating a transaction before signing it. */
export function TxPreview({ sim, loading, chainName, feePerGas, nativeUsd, nativeSymbol = 'ETH', expected }: Props) {
  const contacts = useContacts()
  const who = (a: Address) => contacts.find((c) => same(c.address, a))?.name ?? shortenAddress(a)

  if (loading || !sim)
    return (
      <div className="bg-muted/50 flex items-center gap-2 rounded-md border p-3 text-sm">
        <Loader className="size-4 animate-spin" /> Simulating on {chainName ?? 'the network'}…
      </div>
    )

  if (sim.status === 'revert')
    return (
      <div role="alert" className="flex gap-2 rounded-md border border-red-500/50 bg-red-500/5 p-3 text-sm">
        <ShieldX className="mt-0.5 size-4 shrink-0 text-red-600" />
        <div>
          <p className="font-medium text-red-700 dark:text-red-400">This transaction would fail</p>
          <p className="text-muted-foreground text-xs break-words">
            {sim.reason}. If you sign it anyway, you still pay the network fee.
          </p>
        </div>
      </div>
    )

  if (sim.status === 'unavailable')
    return (
      <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <div>
          <p className="font-medium text-amber-700 dark:text-amber-400">Couldn’t simulate right now</p>
          <p className="text-muted-foreground text-xs">
            The network didn’t answer. Check the details carefully in your wallet before confirming.
          </p>
        </div>
      </div>
    )

  const surprise = surprises(sim, expected)
  const unexpected = surprise.movements
  const surpriseApprovals = surprise.approvals
  const fee = feePerGas !== undefined && sim.gasUsed > 0n ? Number(formatUnits(sim.gasUsed * feePerGas, 18)) : undefined
  const nothing = sim.movements.length === 0 && sim.approvals.length === 0

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-md border p-3 text-sm',
        unexpected.length || surpriseApprovals.length ? 'border-red-500/50 bg-red-500/5' : 'bg-muted/50',
      )}
    >
      <p className="flex items-center gap-2 font-medium">
        <FlaskConical className="size-4 text-emerald-600" />
        {sim.engine === 'simulate' ? 'Simulation: this will succeed' : 'Dry run: this will succeed'}
      </p>
      {(unexpected.length > 0 || surpriseApprovals.length > 0) && (
        <p role="alert" className="flex items-start gap-2 text-xs font-medium text-red-700 dark:text-red-400">
          <ShieldX className="mt-px size-3.5 shrink-0" />
          This does more than you asked for. Don’t sign unless you understand every line below.
        </p>
      )}
      <ul className="flex flex-col gap-1.5">
        {sim.movements.map((m, i) => {
          const surprise = unexpected.includes(m)
          return (
            <li key={`m${i}`} className={cn('flex items-start gap-2', surprise && 'text-red-700 dark:text-red-400')}>
              {m.direction === 'out' ? (
                <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-red-600" />
              ) : (
                <ArrowDownLeft className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              )}
              <span>
                {m.direction === 'out' ? 'You send ' : 'You receive '}
                <b className="tabular-nums">{amountText(m)}</b>
                {m.direction === 'out' ? ' to ' : ' from '}
                {m.toNewContract ? (
                  'your new contract'
                ) : (
                  <span className="font-mono text-xs">{who(m.counterparty)}</span>
                )}
              </span>
            </li>
          )
        })}
        {sim.approvals.map((a, i) => {
          const risky = !a.revoke && (a.amount === 'all' || a.amount >= UNLIMITED)
          return (
            <li
              key={`a${i}`}
              className={cn(
                'flex items-start gap-2',
                risky && 'font-medium text-red-700 dark:text-red-400',
                a.revoke && 'text-emerald-700 dark:text-emerald-400',
              )}
            >
              {a.revoke ? (
                <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              ) : (
                <KeyRound className="mt-0.5 size-4 shrink-0 text-amber-600" />
              )}
              <span>{approvalText(a, who(a.spender))}</span>
            </li>
          )
        })}
        {nothing && (
          <li className="text-muted-foreground">
            {sim.engine === 'simulate'
              ? 'No tokens move and no permissions change.'
              : 'Nothing to show from the transaction data alone — the contract may still move funds.'}
          </li>
        )}
        {fee !== undefined && (
          <li className="text-muted-foreground flex items-start gap-2">
            <Fuel className="mt-0.5 size-4 shrink-0" />
            <span>
              Network fee ≈ {formatAmount(fee, 6)} {nativeSymbol}
              {nativeUsd !== undefined && ` (${formatFiat(fee * nativeUsd)})`}
            </span>
          </li>
        )}
      </ul>
      <p className="text-muted-foreground border-t pt-2 text-xs">
        {sim.engine === 'simulate'
          ? `Run against the latest ${chainName ?? ''} block before you sign. Nothing was sent.`
          : `Your network provider can’t run a full simulation, so this is read from the transaction data after a dry run passed.`}
      </p>
    </div>
  )
}
