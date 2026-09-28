import { useEffect, useRef, useState } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { convertUsd, formatFiat, useCurrency, usePrices, type Currency } from '@/lib/prices'
import { cn } from '@/lib/utils'

type Settings = { direction: 'above' | 'below'; target: string; currency: Currency; enabled: boolean }
const KEY = 'price-alert'

function load(fallback: Currency): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Settings | null
    if (saved && typeof saved.target === 'string') return saved
  } catch {
    // ignore
  }
  return { direction: 'below', target: '', currency: fallback, enabled: false }
}

/** Notifies when ETH crosses a price, in whatever currency the viewer uses. */
export function PriceAlert() {
  const currency = useCurrency()
  const prices = usePrices()
  const [settings, setSettings] = useState(() => load(currency))
  const [permission, setPermission] = useState(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  )
  const update = (next: Partial<Settings>) => {
    const merged = { ...settings, ...next }
    setSettings(merged)
    try {
      localStorage.setItem(KEY, JSON.stringify(merged))
    } catch {
      // ignore
    }
  }

  // Targets are stored with their currency; if the viewer switched currency, compare in the stored one only when it matches.
  const target = /^\d*\.?\d+$/.test(settings.target.replace(/,/g, ''))
    ? Number(settings.target.replace(/,/g, ''))
    : undefined
  const now = prices.data ? convertUsd(prices.data.eth) : undefined
  const comparable = now && now.code === settings.currency
  const hit =
    settings.enabled &&
    target !== undefined &&
    comparable &&
    (settings.direction === 'below' ? now.value <= target : now.value >= target)

  const wasHit = useRef(false)
  useEffect(() => {
    if (hit && !wasHit.current && permission === 'granted' && prices.data) {
      try {
        new Notification(`ETH is ${settings.direction} your target`, {
          body: `ETH is now ${formatFiat(prices.data.eth)}.`,
          tag: 'price-alert',
        })
      } catch {
        // notifications may need a service worker on some browsers
      }
    }
    wasHit.current = !!hit
  }, [hit, permission, prices.data, settings.direction])

  async function enable() {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default')
      setPermission(await Notification.requestPermission())
    update({ enabled: true, currency })
  }

  const Icon = settings.direction === 'below' ? TrendingDown : TrendingUp
  return (
    <Card className={cn(hit && 'ring-2 ring-emerald-500')}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-5" /> ETH price alert
        </CardTitle>
        <CardDescription>
          ETH is {prices.data ? formatFiat(prices.data.eth) : '…'} now. Checks every 2 minutes while this page is open.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Tell me when ETH goes</span>
          <div className="bg-muted inline-flex rounded-md p-1">
            {(['below', 'above'] as const).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={settings.direction === d}
                onClick={() => update({ direction: d })}
                className={cn(
                  'rounded px-3 py-1 font-medium',
                  settings.direction === d ? 'bg-background shadow-xs' : 'text-muted-foreground',
                )}
              >
                {d}
              </button>
            ))}
          </div>
          <Input
            aria-label={`Target ETH price in ${currency}`}
            inputMode="decimal"
            className="w-36"
            placeholder={now ? String(Math.round(now.value * 0.95)) : '2000'}
            value={settings.target}
            onChange={(e) => update({ target: e.target.value.trim(), currency })}
            aria-invalid={settings.target !== '' && target === undefined}
          />
          <span>{settings.enabled ? settings.currency : currency}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {settings.enabled ? (
            <Button variant="outline" onClick={() => update({ enabled: false })}>
              Turn alert off
            </Button>
          ) : (
            <Button onClick={enable} disabled={target === undefined}>
              Turn alert on
            </Button>
          )}
          {permission === 'denied' && (
            <span className="text-muted-foreground text-xs">Desktop notifications are blocked in your browser.</span>
          )}
        </div>
        {hit && (
          <p className="rounded-md bg-emerald-500/10 p-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            ETH is {settings.direction} {settings.target} {settings.currency} right now.
          </p>
        )}
        {settings.enabled && now && !comparable && (
          <p className="text-muted-foreground text-xs">
            This alert is set in {settings.currency}. Switch the currency picker back to {settings.currency} or set a
            new target.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
