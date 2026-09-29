import { useState } from 'react'
import type { Address } from 'viem'
import { CircleCheck, CircleX, ChevronDown, Fish } from 'lucide-react'

import { AddressDiff as Diff } from '@/components/AddressDiff'
import { InfoTip } from '@/components/OnboardingTip'
import { Card, CardContent } from '@/components/ui/card'
import { CountUp } from '@/components/wrapped/CountUp'
import type { Approval } from '@/lib/approvals'
import { navigate } from '@/lib/route'
import { useWalletHealth } from '@/lib/useWalletHealth'
import { cn } from '@/lib/utils'

const GRADE_COLOR: Record<string, string> = {
  A: 'text-emerald-600 dark:text-emerald-400',
  B: 'text-lime-600 dark:text-lime-400',
  C: 'text-amber-600 dark:text-amber-400',
  D: 'text-orange-600 dark:text-orange-400',
  F: 'text-red-600 dark:text-red-400',
}

// A 270° arc, open at the bottom: the score sweeps in from zero when the card appears.
const R = 50
const CIRCUMFERENCE = 2 * Math.PI * R
const ARC = CIRCUMFERENCE * 0.75

function Gauge({ score, grade }: { score: number; grade: string }) {
  return (
    <div
      role="img"
      aria-label={`Health score ${score} out of 100, grade ${grade}`}
      className={cn('relative size-32 shrink-0', GRADE_COLOR[grade])}
    >
      <svg viewBox="0 0 120 120" className="size-full rotate-[135deg]" aria-hidden>
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={`${ARC} ${CIRCUMFERENCE}`}
        />
        <circle
          key={score}
          className="gauge-sweep"
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke="currentColor"
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={`${(ARC * score) / 100} ${CIRCUMFERENCE}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
        <span className="font-display text-foreground text-5xl leading-none tabular-nums">
          <CountUp key={score} text={String(score)} duration={1100} />
        </span>
        <span className="mt-1 text-xs font-semibold tracking-wider uppercase">grade {grade}</span>
      </div>
    </div>
  )
}

export function HealthCard({
  address,
  chainId,
  chainName,
  approvals,
}: {
  address: Address
  chainId: number
  chainName?: string
  approvals: Approval[] | undefined
}) {
  const [open, setOpen] = useState(false)
  const { health, attempts, partial } = useWalletHealth(address, chainId, approvals)
  if (!health) return null

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-5">
          <Gauge score={health.score} grade={health.grade} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-lg font-semibold">
              Wallet health on {chainName}
              <InfoTip label="the health score">
                Starts at 100 and loses points for dangerous approvals (up to −45), risky ones such as unlimited or
                unverified spenders (up to −30), address-poisoning attempts in your history (up to −20) and scam tokens
                (up to −10). A = 90+, B = 75+, C = 60+, D = 40+.
              </InfoTip>
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {health.items.map((i) => (
                <li key={i.text} className="flex items-start gap-2 text-sm">
                  {i.ok ? (
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  ) : (
                    <CircleX className="mt-0.5 size-4 shrink-0 text-red-600" />
                  )}
                  <span className={i.ok ? 'text-muted-foreground' : ''}>{i.text}</span>
                </li>
              ))}
            </ul>
            {partial && (
              <p className="text-muted-foreground mt-2 text-xs">
                Some checks couldn’t load, so this score may be too kind.
              </p>
            )}
          </div>
        </div>

        {attempts.length > 0 && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
            <button
              className="flex w-full items-center gap-2 text-left text-sm font-medium text-red-700 dark:text-red-400"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
            >
              <Fish className="size-4" />
              {attempts.length} poisoning attempt{attempts.length > 1 ? 's' : ''}: fake addresses dressed up as ones you
              use
              <ChevronDown className={cn('ml-auto size-4 transition-transform', open && 'rotate-180')} />
            </button>
            {open && (
              <ul className="mt-3 flex flex-col gap-3">
                {attempts.map((a) => (
                  <li key={`${a.hash}:${a.attacker}`} className="bg-background rounded-md border p-3 text-sm">
                    <p className="mb-2 text-xs">
                      {a.zeroValue ? `Fake 0 ${a.symbol} transfer` : `Tiny ${a.symbol} “dust” transfer`}
                      {a.time && ` · ${a.time.toLocaleDateString()}`}
                      {a.hash && (
                        <>
                          {' · '}
                          <button
                            className="underline underline-offset-4"
                            onClick={() => navigate({ view: 'tx', target: a.hash })}
                          >
                            explain
                          </button>
                        </>
                      )}
                    </p>
                    <p className="text-muted-foreground text-xs">Scammer:</p>
                    <Diff fake={a.attacker} real={a.imitates} />
                    <p className="text-muted-foreground mt-1 text-xs">
                      Imitates{' '}
                      {a.imitates.toLowerCase() === address.toLowerCase() ? 'your own wallet' : 'an address you use'}:
                    </p>
                    <span className="font-mono text-xs break-all">{a.imitates}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-muted-foreground mt-2 text-xs">
              These cost you nothing unless you copy one. Always paste addresses from a trusted source or your Contacts
              — Scam Shield will also catch them when you send.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
