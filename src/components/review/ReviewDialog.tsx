import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Address } from 'viem'
import { useChains, useEstimateFeesPerGas } from 'wagmi'
import { ScanEye, X } from 'lucide-react'

import { ShieldPanel } from '@/components/dashboard/ShieldPanel'
import { TxPreview } from '@/components/review/TxPreview'
import { Button } from '@/components/ui/button'
import { usePrices } from '@/lib/prices'
import type { Finding } from '@/lib/shield'
import { surprises, useSimulation, type ExpectedOut, type SimCall } from '@/lib/simulate'

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  /** One-line summary of what the user is doing. */
  summary: ReactNode
  chainId: number
  account: Address
  calls: SimCall[]
  expected?: ExpectedOut[]
  /** Scam Shield result for the recipient, shown again right before signing. */
  shield?: { findings: Finding[]; loading: boolean }
  confirmLabel: string
  pending?: boolean
  error?: string
  children?: ReactNode
}

/**
 * The last screen before the wallet pops up: the recipient check again, plus a
 * simulation of exactly what the transaction will do.
 */
export function ReviewDialog({
  open,
  onClose,
  onConfirm,
  title,
  summary,
  chainId,
  account,
  calls,
  expected,
  shield,
  confirmLabel,
  pending,
  error,
  children,
}: Props) {
  const chains = useChains()
  const chain = chains.find((c) => c.id === chainId)
  const sim = useSimulation(open ? chainId : undefined, account, calls)
  const fees = useEstimateFeesPerGas({ chainId: chainId as (typeof chains)[number]['id'], query: { enabled: open } })
  const prices = usePrices()
  const cancelRef = useRef<HTMLButtonElement>(null)
  // A warning needs an explicit "yes" each time the review opens.
  const [override, setOverride] = useState(false)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    setOverride(false)
  }

  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !pending && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, pending, onClose])

  if (!open) return null

  const nativeSymbol = chain?.nativeCurrency.symbol ?? 'ETH'
  const nativeUsd = !chain?.testnet && nativeSymbol === 'ETH' ? prices.data?.eth : undefined
  const reverts = sim.data?.status === 'revert'
  const danger = shield?.findings.some((f) => f.level === 'danger')
  const surprise = surprises(sim.data, expected)
  const needsOverride = reverts || surprise.movements.length > 0 || surprise.approvals.length > 0

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && !pending && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
        className="bg-card flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 id="review-title" className="flex items-center gap-2 font-semibold">
            <ScanEye className="text-primary size-5" /> {title}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={pending} aria-label="Close">
            <X />
          </Button>
        </div>
        <div className="flex flex-col gap-3 overflow-y-auto px-5 py-4">
          <div className="text-base">{summary}</div>
          <p className="text-muted-foreground -mt-2 text-xs">
            on <span className="text-foreground font-medium">{chain?.name ?? `chain ${chainId}`}</span>
            {chain?.testnet ? ' (testnet — no real value)' : ' — real funds'}
          </p>
          {shield && <ShieldPanel findings={shield.findings} loading={shield.loading} />}
          <TxPreview
            sim={sim.data}
            loading={sim.isLoading}
            chainName={chain?.name}
            feePerGas={fees.data?.maxFeePerGas ?? fees.data?.gasPrice}
            nativeUsd={nativeUsd}
            nativeSymbol={nativeSymbol}
            expected={expected}
          />
          {children}
          {needsOverride && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={override}
                onChange={(e) => setOverride(e.target.checked)}
              />
              {reverts
                ? 'I understand this will probably fail and still costs a network fee.'
                : 'I understand this moves more than I asked for, and I still want to sign it.'}
            </label>
          )}
          {error && <p className="text-destructive text-sm break-words">{error}</p>}
        </div>
        <div className="flex flex-col-reverse gap-2 border-t px-5 py-3 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant={needsOverride || danger ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={pending || sim.isLoading || (needsOverride && !override)}
          >
            {pending ? 'Confirm in your wallet…' : needsOverride ? `${confirmLabel} anyway` : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
