import { useEffect, useState } from 'react'

const NUMBER = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/s

/** Animates the first number in `text` from 0 up to its value (keeps prefix/suffix and decimals). */
export function CountUp({ text, duration = 1200 }: { text: string; duration?: number }) {
  const match = text.match(NUMBER)
  const target = match ? Number(match[2].replace(/,/g, '')) : NaN
  const decimals = match?.[2].split('.')[1]?.length ?? 0
  const [animate] = useState(
    () => Number.isFinite(target) && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!animate) return
    let raf = 0
    const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      setValue(target * (1 - Math.pow(1 - p, 3))) // ease-out cubic
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [animate, target, duration])

  if (!match || !Number.isFinite(target)) return <>{text}</>
  const shown = (animate ? value : target).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  return (
    <>
      {match[1]}
      <span className="tabular-nums">{shown}</span>
      {match[3]}
    </>
  )
}
