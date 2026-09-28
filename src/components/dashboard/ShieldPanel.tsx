import { CircleCheck, Info, Loader, ShieldAlert, ShieldCheck, TriangleAlert } from 'lucide-react'

import type { Finding } from '@/lib/shield'
import { cn } from '@/lib/utils'

const STYLES: Record<Finding['level'], { icon: typeof Info; className: string }> = {
  danger: { icon: ShieldAlert, className: 'text-red-700 dark:text-red-400' },
  warning: { icon: TriangleAlert, className: 'text-amber-700 dark:text-amber-400' },
  info: { icon: Info, className: 'text-sky-700 dark:text-sky-400' },
  ok: { icon: CircleCheck, className: 'text-emerald-700 dark:text-emerald-400' },
}

type Props = {
  findings: Finding[]
  loading: boolean
  fee?: string
  remaining?: string
}

export function ShieldPanel({ findings, loading, fee, remaining }: Props) {
  const danger = findings.some((f) => f.level === 'danger')
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-md border p-3 text-sm',
        danger ? 'border-red-500/50 bg-red-500/5' : 'bg-muted/50',
      )}
    >
      <p className="flex items-center gap-2 font-medium">
        {loading ? (
          <Loader className="size-4 animate-spin" />
        ) : danger ? (
          <ShieldAlert className="size-4 text-red-600" />
        ) : (
          <ShieldCheck className="size-4 text-emerald-600" />
        )}
        Scam Shield
        {!loading && findings.length === 0 && (
          <span className="text-muted-foreground font-normal">— no issues found</span>
        )}
      </p>
      {findings.map((f) => {
        const { icon: Icon, className } = STYLES[f.level]
        return (
          <div key={f.title} className="flex gap-2">
            <Icon className={cn('mt-0.5 size-4 shrink-0', className)} />
            <div>
              <p className={cn('font-medium', className)}>{f.title}</p>
              {f.detail && <p className="text-muted-foreground text-xs">{f.detail}</p>}
            </div>
          </div>
        )
      })}
      {(fee || remaining) && (
        <div className="text-muted-foreground mt-1 flex flex-wrap justify-between gap-x-4 gap-y-1 border-t pt-2 text-xs">
          {fee && <span>Network fee ≈ {fee}</span>}
          {remaining && <span>Left after sending: {remaining}</span>}
        </div>
      )}
    </div>
  )
}
