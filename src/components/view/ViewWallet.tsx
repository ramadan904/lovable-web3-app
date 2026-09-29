import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { isAddress, type Address } from 'viem'
import { normalize } from 'viem/ens'
import { useChains, useEnsAddress, useEnsName } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { ArrowDownLeft, ArrowUpRight, BookUser, Eye, ScanEye, Sparkles } from 'lucide-react'

import { ListSkeleton } from '@/components/Skeletons'
import { EnsProfile } from '@/components/EnsProfile'
import { Portfolio } from '@/components/dashboard/Portfolio'
import { TokensCard } from '@/components/dashboard/TokensCard'
import { NftsCard } from '@/components/dashboard/NftsCard'
import { GalaxyCard } from '@/components/galaxy/GalaxyCard'
import { Button } from '@/components/ui/button'
import { LoadError, StaleNote } from '@/components/LoadError'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { BLOCKSCOUT } from '@/lib/blockscout'
import { addContact, findContact } from '@/lib/contacts'
import { navigate } from '@/lib/route'
import { describeTx, timeAgo } from '@/lib/txText'
import { shortenAddress } from '@/lib/utils'
import { addWatched, useWatchlist } from '@/lib/watchlist'
import type { BsTx } from '@/lib/wrapped'
import { fetchWithRetry, HttpError } from '@/lib/net'
import { chainLabel } from '@/lib/chains'

function safeNormalize(name: string) {
  try {
    return normalize(name)
  } catch {
    return undefined
  }
}

function RecentTransactions({ address }: { address: Address }) {
  const chains = useChains()
  const [chainId, setChainId] = useState<number>(chains[0].id)
  const [now] = useState(() => Date.now())
  const txs = useQuery({
    queryKey: ['recent-txs', chainId, address.toLowerCase()],
    staleTime: 60_000,
    retry: 1,
    queryFn: async () => {
      const res = await fetchWithRetry(`${BLOCKSCOUT[chainId]}/api/v2/addresses/${address}/transactions`)
      if (res.status === 404) return []
      if (!res.ok) throw new HttpError(res, 'Explorer request')
      return ((await res.json()) as { items?: BsTx[] }).items?.slice(0, 15) ?? []
    },
  })

  return (
    <Card className="md:col-span-2">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1.5">
          <CardTitle>Recent transactions</CardTitle>
          <CardDescription>Latest activity, in plain English. Tap one for the full explanation.</CardDescription>
        </div>
        <div className="chip-row">
          {chains
            .filter((c) => BLOCKSCOUT[c.id])
            .map((c) => (
              <Button
                key={c.id}
                size="sm"
                variant={c.id === chainId ? 'default' : 'outline'}
                onClick={() => setChainId(c.id)}
              >
                {chainLabel(c)}
              </Button>
            ))}
        </div>
      </CardHeader>
      <CardContent>
        {txs.isError && txs.data && <StaleNote updatedAt={txs.dataUpdatedAt} onRetry={() => txs.refetch()} />}
        {txs.isLoading ? (
          <ListSkeleton rows={4} label="Loading transactions" />
        ) : txs.isError && !txs.data ? (
          <LoadError what="transactions" onRetry={() => txs.refetch()} retrying={txs.isFetching} />
        ) : !txs.data?.length ? (
          <p className="text-muted-foreground py-6 text-center text-sm">No transactions on this network.</p>
        ) : (
          <ul className="divide-y">
            {txs.data.map((tx) => {
              const d = describeTx(tx, address)
              return (
                <li key={tx.hash}>
                  <button
                    onClick={() => navigate({ view: 'tx', target: tx.hash })}
                    className="hover:bg-muted/60 flex w-full items-start gap-3 rounded-md px-1 py-3 text-left text-sm"
                  >
                    {d.outgoing ? (
                      <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-rose-500" />
                    ) : (
                      <ArrowDownLeft className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block first-letter:uppercase">{d.text}</span>
                      <span className="text-muted-foreground text-xs">{timeAgo(Date.parse(tx.timestamp), now)}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export function ViewWallet({ target }: { target?: string }) {
  const [input, setInput] = useState(target ?? '')
  const watchlist = useWatchlist()
  const [saved, setSaved] = useState<string>()

  const query = target ?? ''
  const contact = query && !isAddress(query) ? findContact(query) : undefined
  const ensName = !isAddress(query) && !contact && query.includes('.') ? safeNormalize(query) : undefined
  const ens = useEnsAddress({ name: ensName, chainId: mainnet.id, query: { enabled: !!ensName } })
  const address: Address | undefined = isAddress(query) ? query : (contact?.address ?? ens.data ?? undefined)
  const reverse = useEnsName({ address, chainId: mainnet.id, query: { enabled: !!address && !ensName } })
  const label = contact?.name ?? ensName ?? reverse.data ?? (address ? shortenAddress(address) : query)
  const watching = !!address && watchlist.some((w) => w.address.toLowerCase() === address.toLowerCase())

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const v = input.trim()
    if (v) navigate({ view: 'view', target: v })
  }

  function saveContact() {
    if (!address) return
    const nick = (ensName?.split('.')[0] ?? `wallet-${address.slice(2, 6)}`).slice(0, 24)
    const problem = addContact(nick, address)
    setSaved(problem ?? `Saved as “${nick}”`)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display flex items-center gap-2.5 text-3xl tracking-tight sm:text-4xl">
          <ScanEye className="text-primary size-6" /> View any wallet
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          A read-only look at any address or ENS name — no wallet connection needed. Nothing can be signed here.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="vitalik.eth, 0x…, or a contact"
          className="font-mono"
          spellCheck={false}
          autoComplete="off"
          aria-label="Wallet to view"
        />
        <Button type="submit">View</Button>
      </form>

      {!query ? (
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
          Try:
          {['vitalik.eth', 'jesse.base.eth'].map((n) => (
            <Button key={n} size="sm" variant="outline" onClick={() => navigate({ view: 'view', target: n })}>
              {n}
            </Button>
          ))}
        </div>
      ) : ensName && ens.isLoading ? (
        <p className="text-muted-foreground py-10 text-center text-sm">Looking up {ensName}…</p>
      ) : !address ? (
        <p className="text-destructive py-10 text-center text-sm">Couldn’t find a wallet for “{query}”.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
            <div className="min-w-0">
              <p className="text-lg font-semibold">{label}</p>
              <p className="text-muted-foreground font-mono text-xs break-all">{address}</p>
              {(ensName ?? reverse.data) && (
                <div className="mt-3">
                  <EnsProfile name={(ensName ?? reverse.data)!} />
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate({ view: 'wrapped', target: ensName ?? address })}
              >
                <Sparkles /> Wrap it
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={watching}
                onClick={() => addWatched(address, ensName ?? contact?.name ?? shortenAddress(address))}
              >
                <Eye /> {watching ? 'Watching' : 'Watch it'}
              </Button>
              {!contact && (
                <Button size="sm" variant="outline" onClick={saveContact} disabled={!!saved}>
                  <BookUser /> {saved ?? 'Save contact'}
                </Button>
              )}
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <Portfolio address={address} />
            <TokensCard address={address} />
            <GalaxyCard address={address} label={label} />
            <NftsCard address={address} />
            <RecentTransactions address={address} />
          </div>
        </>
      )}
    </div>
  )
}
