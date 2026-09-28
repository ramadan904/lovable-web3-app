import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function shortenAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function formatAmount(value: number, maxDecimals = 4) {
  if (value === 0) return '0'
  if (value < 1 / 10 ** maxDecimals) return `<${1 / 10 ** maxDecimals}`
  return value.toLocaleString(undefined, { maximumFractionDigits: maxDecimals })
}
