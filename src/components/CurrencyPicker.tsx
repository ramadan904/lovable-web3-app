import { CURRENCIES, setCurrency, useCurrency, type Currency } from '@/lib/prices'

export function CurrencyPicker() {
  const currency = useCurrency()
  return (
    <select
      value={currency}
      onChange={(e) => setCurrency(e.target.value as Currency)}
      aria-label="Display currency"
      className="hover:bg-muted h-9 cursor-pointer rounded-md bg-transparent px-1.5 text-xs font-medium outline-none"
    >
      {CURRENCIES.map((c) => (
        <option key={c} value={c}>
          {c === 'NGN' ? '₦ NGN' : c}
        </option>
      ))}
    </select>
  )
}
