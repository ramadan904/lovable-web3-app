import { useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'

export type Prices = { eth: number; usdc: number }

export const CURRENCIES = ['USD', 'NGN', 'EUR', 'GBP'] as const
export type Currency = (typeof CURRENCIES)[number]

// Display currency + USD→currency rates. All maths in the app stays in USD;
// only formatting converts, so a missing rate just falls back to dollars.
const KEY = 'currency'
let currency: Currency = (() => {
  try {
    const saved = localStorage.getItem(KEY)
    return (CURRENCIES as readonly string[]).includes(saved ?? '') ? (saved as Currency) : 'USD'
  } catch {
    return 'USD'
  }
})()
let rates: Partial<Record<Currency, number>> = { USD: 1 }
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function setCurrency(next: Currency) {
  currency = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // ignore
  }
  emit()
}

export function useCurrency() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => currency,
  )
}

/** Prices in USD from CoinGecko's free public API; undefined if unavailable. Also refreshes FX rates. */
export function usePrices() {
  return useQuery({
    queryKey: ['prices'],
    queryFn: async (): Promise<Prices> => {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,usd-coin&vs_currencies=usd,ngn,eur,gbp',
      )
      if (!res.ok) throw new Error(`Price request failed: ${res.status}`)
      const data = (await res.json()) as Record<string, Partial<Record<string, number>>>
      const eth = data.ethereum?.usd
      if (typeof eth !== 'number') throw new Error('Price missing from response')
      const next: Partial<Record<Currency, number>> = { USD: 1 }
      for (const c of CURRENCIES) {
        const v = data.ethereum?.[c.toLowerCase()]
        if (typeof v === 'number' && v > 0) next[c] = v / eth
      }
      rates = next
      emit()
      return { eth, usdc: data['usd-coin']?.usd ?? 1 }
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
  })
}

/** A USD amount converted to the viewer's currency (falls back to USD when no rate is known). */
export function convertUsd(usd: number): { value: number; code: Currency } {
  const rate = rates[currency]
  return rate ? { value: usd * rate, code: currency } : { value: usd, code: 'USD' }
}

/** Formats a USD amount in the viewer's chosen currency. */
export function formatFiat(usd: number) {
  const rate = rates[currency]
  const [code, value] = rate ? [currency, usd * rate] : ['USD', usd]
  return value.toLocaleString(undefined, {
    style: 'currency',
    currency: code,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: code === 'NGN' && Math.abs(value) >= 100 ? 0 : 2,
  })
}
