import { cn } from '@/lib/utils'

/** Shows `fake` with the characters that differ from `real` highlighted. */
export function AddressDiff({
  fake,
  real,
  className,
  highlight = 'rounded-sm bg-red-500/20 text-red-700 dark:text-red-300',
}: {
  fake: string
  real: string
  className?: string
  highlight?: string
}) {
  return (
    <span className={cn('font-mono text-xs break-all', className)}>
      {[...fake].map((ch, i) => (
        <span key={i} className={ch.toLowerCase() !== real[i]?.toLowerCase() ? highlight : ''}>
          {ch}
        </span>
      ))}
    </span>
  )
}
