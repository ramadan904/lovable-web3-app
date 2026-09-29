import { RefreshCw, WifiOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Shown instead of content when a third-party source failed and there's nothing cached to show. */
export function LoadError({
  what,
  source = 'the block explorer',
  onRetry,
  retrying,
  className,
}: {
  what: string
  source?: string
  onRetry?: () => void
  retrying?: boolean
  className?: string
}) {
  return (
    <div role="status" className={cn('flex flex-col items-center gap-2 py-6 text-center text-sm', className)}>
      <WifiOff className="text-muted-foreground size-5" aria-hidden />
      <p className="font-medium">
        Couldn’t load {what} from {source}.
      </p>
      <p className="text-muted-foreground max-w-sm text-xs">
        It may be busy or blocked on your network. Your wallet and funds are not affected.
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
          <RefreshCw className={cn(retrying && 'animate-spin')} /> {retrying ? 'Retrying…' : 'Try again'}
        </Button>
      )}
    </div>
  )
}

/** A quiet note when a refresh failed but older data is still on screen. */
export function StaleNote({ updatedAt, onRetry }: { updatedAt: number; onRetry?: () => void }) {
  const time = updatedAt ? new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
  return (
    <p role="status" className="mb-3 flex flex-wrap items-center gap-x-2 text-xs text-amber-700 dark:text-amber-400">
      <WifiOff className="size-3.5" aria-hidden />
      Couldn’t refresh{time && ` — showing data from ${time}`}.
      {onRetry && (
        <button type="button" className="underline underline-offset-2" onClick={onRetry}>
          Retry
        </button>
      )}
    </p>
  )
}
