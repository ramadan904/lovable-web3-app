// Loading placeholders shaped like the content they stand in for, so pages
// don't jump when data lands. Each announces itself once to screen readers.

/** Rows like a token or activity list: icon, two lines, a value on the right. */
export function ListSkeleton({ rows = 4, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col divide-y">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-3" aria-hidden>
          <span className="skeleton size-8 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <span className="skeleton h-3.5 rounded" style={{ width: `${55 - i * 7}%` }} />
            <span className="skeleton h-3 w-1/4 rounded" />
          </div>
          <span className="skeleton h-4 w-16 rounded" />
        </div>
      ))}
    </div>
  )
}

/** Square tiles like an NFT grid. */
export function TileSkeleton({ tiles = 6, label }: { tiles?: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {Array.from({ length: tiles }, (_, i) => (
        <div key={i} className="flex flex-col gap-2" aria-hidden>
          <span className="skeleton aspect-square w-full rounded-lg" />
          <span className="skeleton h-3 w-2/3 rounded" />
        </div>
      ))}
    </div>
  )
}

/** Faint orbits while the wallet galaxy is being mapped. */
export function OrbitSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="relative mx-auto aspect-square w-full max-w-md">
      {[0.34, 0.52, 0.7, 0.88].map((f, i) => (
        <span
          key={f}
          aria-hidden
          className="border-muted-foreground/20 absolute top-1/2 left-1/2 -translate-1/2 animate-pulse rounded-full border"
          style={{ width: `${f * 100}%`, height: `${f * 100}%`, animationDelay: `${i * 180}ms` }}
        />
      ))}
      <span aria-hidden className="skeleton absolute top-1/2 left-1/2 size-10 -translate-1/2 rounded-full" />
      <p className="text-muted-foreground absolute inset-x-0 bottom-2 text-center text-xs">{label}</p>
    </div>
  )
}

/** A page heading and two cards, while a page's code is still downloading. */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading page" className="flex flex-col gap-6 py-2">
      <div className="flex flex-col gap-2" aria-hidden>
        <span className="skeleton h-7 w-56 rounded-lg" />
        <span className="skeleton h-4 w-full max-w-lg rounded" />
      </div>
      <div className="grid gap-6 md:grid-cols-2" aria-hidden>
        <span className="skeleton h-56 rounded-xl" />
        <span className="skeleton h-56 rounded-xl" />
      </div>
    </div>
  )
}
