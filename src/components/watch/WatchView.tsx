import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useQueries, type UseQueryResult } from '@tanstack/react-query'
import { formatUnits, isAddress, type Address } from 'viem'
import { normalize } from 'viem/ens'
import { getEnsAddress } from 'wagmi/actions'
import { base, mainnet } from 'wagmi/chains'
import { ArrowDownLeft, ArrowUpRight, Bell, BellRing, Eye, Plus, X, Zap } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { BLOCKSCOUT } from '@/lib/blockscout'
import { config } from '@/lib/wagmi'
import { addWatched, MAX_WATCHED, removeWatched, useWatchlist, type Watched } from '@/lib/watchlist'
import type { BsTx } from '@/lib/wrapped'
import { cn, formatAmount, shortenAddress } from '@/lib/utils'

const CHAINS = [
  { id: mainnet.id, name: 'Ethereum', explorer: 'https://etherscan.io' },
  { id: base.id, name: 'Base', explorer: 'https://basescan.org' },
]
const POLL_MS = 30_000

type FeedItem = { tx: BsTx; who: Watched; chain: (typeof CHAINS)[number]; time: number }

function describe({ tx, who }: FeedItem) {
  const me = who.address.toLowerCase()
  const outgoing = tx.from?.hash?.toLowerCase() === me
  const other = outgoing ? tx.to : tx.from
  const otherLabel =
    (other && 'name' in other && other.name) || (other?.hash ? shortenAddress(other.hash) : 'a contract')
  const eth = Number(formatUnits(BigInt(tx.value ?? '0'), 18))
  const method = tx.method && !tx.method.startsWith('0x') ? tx.method : undefined
  const failed = tx.status === 'error' ? ' (failed)' : ''
  if (eth > 0)
    return {
      outgoing,
      text: `${outgoing ? 'sent' : 'received'} ${formatAmount(eth)} ETH ${outgoing ? 'to' : 'from'} ${otherLabel}${failed}`,
    }
  if (outgoing) return { outgoing, text: `called ${method ?? 'a function'} on ${otherLabel}${failed}` }
  return { outgoing, text: `was sent a transaction by ${otherLabel}${failed}` }
}

function ago(ms: number) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86_400)}d ago`
}

type Batch = { who: Watched; chain: (typeof CHAINS)[number]; items: BsTx[] }

const DEFAULT_TITLE = 'Lovable Web3 App'
const setTabTitle = (title: string) => {
  document.title = title
}

/** Merge every wallet × chain result into one newest-first feed (stable while data is unchanged). */
function combineFeed(results: UseQueryResult<Batch>[]) {
  const seen = new Set<string>()
  const feed: FeedItem[] = []
  for (const r of results) {
    if (!r.data) continue
    const { who, chain, items } = r.data
    for (const tx of items) {
      const key = `${chain.id}:${tx.hash}:${who.address}`
      if (seen.has(key)) continue
      seen.add(key)
      feed.push({ tx, who, chain, time: Date.parse(tx.timestamp) })
    }
  }
  feed.sort((a, b) => b.time - a.time)
  return { feed, loading: results.some((r) => r.isLoading) }
}

async function latestTxs(chainId: number, address: Address) {
  const res = await fetch(`${BLOCKSCOUT[chainId]}/api/v2/addresses/${address}/transactions`)
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`Explorer error ${res.status}`)
  const body = (await res.json()) as { items?: BsTx[] }
  return (body.items ?? []).slice(0, 10)
}

export function WatchView() {
  const list = useWatchlist()
  const [input, setInput] = useState('')
  const [error, setError] = useState<string>()
  const [adding, setAdding] = useState(false)
  const [startedAt] = useState(() => Date.now())
  const [permission, setPermission] = useState(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  )
  const [, tick] = useState(0)

  // Re-render every 15s so "x ago" stays fresh.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 15_000)
    return () => clearInterval(t)
  }, [])

  const { feed, loading } = useQueries({
    queries: list.flatMap((who) =>
      CHAINS.map((chain) => ({
        queryKey: ['watch', chain.id, who.address],
        queryFn: async (): Promise<Batch> => ({ who, chain, items: await latestTxs(chain.id, who.address) }),
        refetchInterval: POLL_MS,
        staleTime: POLL_MS / 2,
      })),
    ),
    combine: combineFeed,
  })
  const fresh = useMemo(() => feed.filter((f) => f.time > startedAt - 5_000), [feed, startedAt])

  // Desktop notification + tab title for anything that lands while the page is open.
  const notified = useRef(new Set<string>())
  useEffect(() => {
    for (const f of fresh) {
      const key = `${f.chain.id}:${f.tx.hash}`
      if (notified.current.has(key)) continue
      notified.current.add(key)
      if (permission === 'granted') {
        try {
          new Notification(`${f.who.label} on ${f.chain.name}`, { body: describe(f).text, tag: key })
        } catch {
          // some browsers only allow notifications from a service worker
        }
      }
    }
    setTabTitle(fresh.length ? `(${fresh.length}) Whale Watch` : DEFAULT_TITLE)
    return () => setTabTitle(DEFAULT_TITLE)
  }, [fresh, permission])

  async function onAdd(e: FormEvent) {
    e.preventDefault()
    const value = input.trim()
    if (!value) return
    setError(undefined)
    if (list.length >= MAX_WATCHED) return setError(`You can watch up to ${MAX_WATCHED} wallets.`)
    setAdding(true)
    try {
      let address: Address | null = null
      let label = value
      if (isAddress(value)) {
        address = value
        label = shortenAddress(value)
      } else {
        address = await getEnsAddress(config, { name: normalize(value), chainId: mainnet.id })
      }
      if (!address) return setError(`Couldn’t find a wallet for “${value}”.`)
      if (!addWatched(address, label)) return setError('Already on your list.')
      setInput('')
    } catch {
      setError(`Couldn’t look up “${value}”.`)
    } finally {
      setAdding(false)
    }
  }

  async function enableAlerts() {
    if (typeof Notification === 'undefined') return
    setPermission(await Notification.requestPermission())
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Eye className="size-6" /> Whale Watch
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Follow any wallet on Ethereum and Base and get alerted the moment it moves. Checks every 30 seconds while this
          page is open; your list stays in this browser.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle>Watching</CardTitle>
            <CardDescription>
              {list.length}/{MAX_WATCHED} wallets
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form onSubmit={onAdd} className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="vitalik.eth or 0x…"
                className="font-mono"
                spellCheck={false}
                autoComplete="off"
                aria-label="Wallet to watch"
              />
              <Button type="submit" disabled={adding} aria-label="Add to watchlist">
                <Plus />
              </Button>
            </form>
            {error && <p className="text-destructive text-xs">{error}</p>}
            {list.length === 0 ? (
              <div className="flex flex-col items-start gap-2">
                <p className="text-muted-foreground text-sm">Nobody yet. Start with a famous one:</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addWatched('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', 'vitalik.eth')}
                >
                  <Plus /> vitalik.eth
                </Button>
              </div>
            ) : (
              <ul className="divide-y">
                {list.map((w) => (
                  <li key={w.address} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{w.label}</p>
                      <p className="text-muted-foreground font-mono text-xs">{shortenAddress(w.address)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Stop watching ${w.label}`}
                      onClick={() => removeWatched(w.address)}
                    >
                      <X />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {permission !== 'unsupported' && (
              <Button
                variant={permission === 'granted' ? 'secondary' : 'outline'}
                onClick={enableAlerts}
                disabled={permission !== 'default'}
              >
                {permission === 'granted' ? <BellRing /> : <Bell />}
                {permission === 'granted'
                  ? 'Desktop alerts on'
                  : permission === 'denied'
                    ? 'Alerts blocked in browser settings'
                    : 'Enable desktop alerts'}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              Live feed
            </CardTitle>
            <CardDescription>
              {fresh.length
                ? `${fresh.length} new since you opened this page`
                : 'Latest moves from your watchlist. New ones are highlighted.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {list.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">Add a wallet to start the feed.</p>
            ) : loading && feed.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">Loading…</p>
            ) : feed.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">No transactions found yet.</p>
            ) : (
              <ul className="divide-y">
                {feed.slice(0, 20).map((f) => {
                  const d = describe(f)
                  const isNew = f.time > startedAt - 5_000
                  return (
                    <li
                      key={`${f.chain.id}:${f.tx.hash}:${f.who.address}`}
                      className={cn('flex items-start gap-3 py-3 text-sm', isNew && 'animate-rise')}
                    >
                      {d.outgoing ? (
                        <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-rose-500" />
                      ) : (
                        <ArrowDownLeft className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p>
                          <span className="font-medium">{f.who.label}</span> {d.text}
                          {isNew && (
                            <span className="ml-2 inline-flex items-center gap-0.5 rounded bg-amber-400/20 px-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                              <Zap className="size-3" /> NEW
                            </span>
                          )}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {f.chain.name} · {ago(f.time)} ·{' '}
                          <a
                            href={`${f.chain.explorer}/tx/${f.tx.hash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="underline underline-offset-4"
                          >
                            view
                          </a>
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
