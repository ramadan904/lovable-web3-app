import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { CircleHelp, Lightbulb, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { dismissTip, useTipDismissed } from '@/lib/tips'
import { cn } from '@/lib/utils'

/** A first-visit explainer card; "Got it" hides it for good in this browser. */
export function OnboardingTip({
  id,
  title,
  children,
  className,
}: {
  id: string
  title: string
  children: ReactNode
  className?: string
}) {
  const hidden = useTipDismissed(id)
  if (hidden) return null
  return (
    <aside
      aria-label={title}
      className={cn('border-primary/30 bg-primary/5 relative flex gap-3 rounded-xl border p-4 text-sm', className)}
    >
      <Lightbulb className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 pr-6">
        <p className="font-semibold">{title}</p>
        <div className="text-muted-foreground mt-1 flex flex-col gap-1.5">{children}</div>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => dismissTip(id)}>
          Got it
        </Button>
      </div>
      <button
        type="button"
        onClick={() => dismissTip(id)}
        aria-label={`Dismiss tip: ${title}`}
        className="text-muted-foreground hover:text-foreground absolute top-3 right-3 rounded p-1"
      >
        <X className="size-4" />
      </button>
    </aside>
  )
}

/** A small "?" that explains a term. Opens on mouse hover, click/tap or Enter; Escape or tapping elsewhere closes it. */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', close)
    document.addEventListener('pointerdown', close)
    return () => {
      document.removeEventListener('keydown', close)
      document.removeEventListener('pointerdown', close)
    }
  }, [open])

  return (
    <span
      ref={ref}
      className="relative inline-flex align-middle"
      // Hover is for mice only: a tap also emits enter/focus, which would fight the click toggle.
      onPointerEnter={(e) => e.pointerType === 'mouse' && setOpen(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setOpen(false)}
    >
      <button
        type="button"
        aria-label={`What is ${label}?`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        className="text-muted-foreground hover:text-foreground rounded-full"
      >
        <CircleHelp className="size-4" />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="bg-card text-card-foreground absolute top-full left-1/2 z-40 mt-2 w-64 max-w-[80vw] -translate-x-1/2 rounded-lg border p-3 text-xs leading-relaxed font-normal shadow-lg"
        >
          {children}
        </span>
      )}
    </span>
  )
}
