import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * A button that only fires after being held down — for overriding a warning,
 * where a single click is too easy. Works with pointer, touch and keyboard
 * (hold Space or Enter); letting go early cancels.
 */
export function HoldButton({
  onComplete,
  children,
  ms = 1600,
  disabled,
  className,
}: {
  onComplete: () => void
  children: ReactNode
  ms?: number
  disabled?: boolean
  className?: string
}) {
  const [holding, setHolding] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const hintId = useId()

  const start = () => {
    if (disabled || timer.current) return
    setHolding(true)
    timer.current = setTimeout(() => {
      timer.current = undefined
      setHolding(false)
      onComplete()
    }, ms)
  }
  const cancel = () => {
    clearTimeout(timer.current)
    timer.current = undefined
    setHolding(false)
  }
  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        aria-describedby={hintId}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId)
          start()
        }}
        onPointerUp={cancel}
        onPointerCancel={cancel}
        onPointerLeave={cancel}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
            e.preventDefault()
            start()
          }
        }}
        onKeyUp={(e) => (e.key === ' ' || e.key === 'Enter') && cancel()}
        onBlur={cancel}
        className={cn(
          'relative isolate inline-flex touch-none items-center justify-center gap-2 overflow-hidden rounded-lg border border-rose-400/50 px-4 py-2 text-sm font-semibold text-rose-200 transition select-none disabled:opacity-50',
          className,
        )}
      >
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 -z-10 bg-rose-500/35"
          style={{ width: holding ? '100%' : '0%', transition: `width ${holding ? ms : 180}ms linear` }}
        />
        {holding ? 'Keep holding…' : children}
      </button>
      <span id={hintId} className="sr-only">
        Press and hold for {Math.round(ms / 100) / 10} seconds to confirm.
      </span>
    </>
  )
}
