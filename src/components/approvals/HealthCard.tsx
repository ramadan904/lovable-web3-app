import { useState } from 'react'
import type { Address } from 'viem'
import { CircleCheck, CircleX, ChevronDown, Fish } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import type { Approval } from '@/lib/approvals'
import { navigate } from '@/lib/route'
import { useWalletHealth } from '@/lib/useWalletHealth'
import { cn } from '@/lib/utils'

const GRADE_COLOR: Record<string, string> = {
  A: 'text-emerald-600 ring-emerald-500/40',
  B: 'text-lime-600 ring-lime-500/40',
  C: 'text-amber-600 ring-amber-500/40',
  D: 'text-orange-600 ring-orange-500/40',
  F: 'text-red-600 ring-red-500/40',
}

/** Shows `fake` with the characters that differ from `real` highlighted. */
function Diff({ fake, real }: { fake: string; real: string }) {
  return (
    <span className="font-mono text-xs break-all">
      {[...fake].map((ch, i) => (
        <span
          key={i}
          className={
            ch.toLowerCase() !== real[i]?.toLowerCase() ? 'rounded-sm bg-red-500/20 text-red-700 dark:text-red-300' : ''
          }
        >
          {ch}
        </span>
      ))}
    </span>
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
          <div
            className={cn(
              'flex size-24 shrink-0 flex-col items-center justify-center rounded-full ring-8',
              GRADE_COLOR[health.grade],
            )}
            aria-label={`Health score ${health.score} out of 100, grade ${health.grade}`}
          >
            <span className="text-3xl leading-none font-extrabold">{health.score}</span>
            <span className="text-xs font-semibold">grade {health.grade}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold">Wallet health on {chainName}</p>
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
