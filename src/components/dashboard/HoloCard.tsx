import { useRef, useState, type PointerEvent } from 'react'
import type { Address } from 'viem'
import { useChains, useEnsName } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { QRCodeSVG } from 'qrcode.react'
import { RotateCcw } from 'lucide-react'

import { toEth, toUsdc, useBalances } from '@/lib/balances'
import { formatFiat, nativeUsd, usePrices } from '@/lib/prices'

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Groups an address like a card number: 0xC374 ab12 … a5A2 */
function cardNumber(address: string) {
  const body = address.slice(2)
  return `0x${body.slice(0, 4)} ${body.slice(4, 8)} ···· ${body.slice(-8, -4)} ${body.slice(-4)}`
}

/**
 * A holographic "wallet card": tilts toward the pointer with a moving sheen,
 * and flips on click/Enter to show the receive QR code.
 */
export function HoloCard({
  address,
  className = 'md:col-span-2',
  hint = 'Tap the card to flip it',
  holder,
}: {
  address: Address
  className?: string
  hint?: string
  /** Shown until (or if) the ENS lookup doesn't return a name. */
  holder?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [flipped, setFlipped] = useState(false)
  const ens = useEnsName({ address, chainId: mainnet.id })
  const { balances } = useBalances(address)
  const prices = usePrices()
  const chains = useChains()

  const total = prices.data
    ? balances.reduce((s, b) => {
        const chain = chains.find((c) => c.id === b.chainId)
        if (!chain || chain.testnet) return s
        const coin = nativeUsd(prices.data, chain) ?? 0
        return s + (b.eth ? toEth(b.eth) * coin : 0) + (b.usdc ? toUsdc(b.usdc) * prices.data!.usdc : 0)
      }, 0)
    : undefined

  function onMove(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current
    // Touch drags are page scrolls, not tilts; on phones the card just flips on tap.
    if (!el || reduced() || e.pointerType !== 'mouse') return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    el.style.setProperty('--rx', `${(0.5 - y) * 16}deg`)
    el.style.setProperty('--ry', `${(x - 0.5) * 22}deg`)
    el.style.setProperty('--mx', `${x * 100}%`)
    el.style.setProperty('--my', `${y * 100}%`)
  }
  function onLeave() {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
  }

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="w-full max-w-md [perspective:1200px]">
        <div
          ref={ref}
          role="button"
          tabIndex={0}
          aria-label={flipped ? 'Show card front' : 'Flip card to show receive QR code'}
          onPointerMove={onMove}
          onPointerLeave={onLeave}
          onClick={() => setFlipped((f) => !f)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setFlipped((f) => !f))}
          className="holo-card relative aspect-[1.586] w-full cursor-pointer rounded-2xl outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
          style={{ transform: `rotateX(var(--rx, 0deg)) rotateY(calc(var(--ry, 0deg) + ${flipped ? 180 : 0}deg))` }}
        >
          {/* front */}
          <div className="holo-face from-brand-from via-brand-via to-brand-to absolute inset-0 overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-2xl sm:p-6">
            <div className="holo-sheen pointer-events-none absolute inset-0" />
            <div className="holo-glare pointer-events-none absolute inset-0" />
            <div className="relative flex h-full flex-col justify-between">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold tracking-wide">
                  <img
                    src={`${import.meta.env.BASE_URL}favicon.svg`}
                    alt=""
                    className="size-6 rounded-md ring-1 ring-white/40"
                  />
                  WALLET BODYGUARD
                </div>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold tracking-widest backdrop-blur">
                  SELF-CUSTODY
                </span>
              </div>
              <div className="holo-chip h-8 w-11 rounded-md sm:h-9 sm:w-12" aria-hidden />
              <div>
                <p className="font-mono text-base tracking-wider drop-shadow sm:text-lg">{cardNumber(address)}</p>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] tracking-widest opacity-80">HOLDER</p>
                    <p className="truncate font-semibold">{ens.data ?? holder ?? 'Anon'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] tracking-widest opacity-80">VALUE</p>
                    <p className="font-semibold tabular-nums">{total !== undefined ? formatFiat(total) : '···'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* back */}
          <div className="holo-face holo-back absolute inset-0 flex items-center justify-center gap-4 overflow-hidden rounded-2xl bg-slate-950 p-5 text-white shadow-2xl">
            <div className="rounded-lg bg-white p-2">
              <QRCodeSVG value={address} size={120} bgColor="#ffffff" fgColor="#000000" />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-brand text-lg font-bold">Scan to pay me</p>
              <p className="mt-1 font-mono text-[11px] break-all opacity-80">{address}</p>
              <p className="mt-2 text-[11px] opacity-60">Ethereum · Base · Arbitrum · Optimism · Polygon</p>
            </div>
          </div>
        </div>
      </div>
      <p className="text-muted-foreground flex items-center gap-1 text-xs">
        <RotateCcw className="size-3" /> {hint}
      </p>
    </div>
  )
}
