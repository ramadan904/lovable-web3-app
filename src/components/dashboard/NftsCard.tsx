import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { useChains } from 'wagmi'
import { ChevronDown, EyeOff, ImageOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BLOCKSCOUT } from '@/lib/blockscout'
import { toNfts, type BsNft, type Nft } from '@/lib/nfts'
import { cn } from '@/lib/utils'

const PAGE = 24

function NftTile({ n, explorer, dim }: { n: Nft; explorer?: string; dim?: boolean }) {
  const [broken, setBroken] = useState(false)
  const href = explorer ? `${explorer}/token/${n.contract}?a=${encodeURIComponent(n.tokenId)}` : undefined
  const body = (
    <>
      <div className="bg-muted relative aspect-square overflow-hidden rounded-lg">
        {n.image && !broken && !dim ? (
          <img
            src={n.image}
            alt={n.name}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
            className="size-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="text-muted-foreground flex size-full items-center justify-center">
            {dim ? <EyeOff className="size-6" /> : <ImageOff className="size-6" />}
          </div>
        )}
        {n.count && (
          <span className="absolute top-1.5 right-1.5 rounded bg-black/70 px-1.5 text-xs font-medium text-white">
            ×{n.count}
          </span>
        )}
      </div>
      <p className="mt-1.5 truncate text-sm font-medium">{n.name}</p>
      <p className={cn('truncate text-xs', n.spam ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground')}>
        {n.spam ?? n.collection}
      </p>
    </>
  )
  return href && !dim ? (
    <a href={href} target="_blank" rel="noreferrer" className="group block min-w-0">
      {body}
    </a>
  ) : (
    <div className="min-w-0">{body}</div>
  )
}

export function NftsCard({ address }: { address: Address }) {
  const chains = useChains()
  const [chainId, setChainId] = useState<number>(chains[1]?.id ?? chains[0].id)
  const [showSpam, setShowSpam] = useState(false)
  const chain = chains.find((c) => c.id === chainId)

  const nfts = useQuery({
    queryKey: ['nfts', chainId, address.toLowerCase()],
    enabled: !!BLOCKSCOUT[chainId],
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async () => {
      const res = await fetch(`${BLOCKSCOUT[chainId]}/api/v2/addresses/${address}/nft?type=ERC-721,ERC-1155`)
      if (res.status === 404) return { items: [] as Nft[], more: false }
      if (!res.ok) throw new Error(`Explorer error ${res.status}`)
      const body = (await res.json()) as { items?: BsNft[]; next_page_params?: unknown }
      return { items: toNfts(body.items ?? []), more: !!body.next_page_params }
    },
  })

  const all = nfts.data?.items ?? []
  const real = all.filter((n) => !n.spam)
  const spam = all.filter((n) => n.spam)

  return (
    <Card className="md:col-span-2">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1.5">
          <CardTitle>NFTs</CardTitle>
          <CardDescription>
            {real.length
              ? `${real.length}${nfts.data?.more ? '+' : ''} on ${chain?.name}`
              : `Collectibles on ${chain?.name}`}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {chains
            .filter((c) => BLOCKSCOUT[c.id])
            .map((c) => (
              <Button
                key={c.id}
                size="sm"
                variant={c.id === chainId ? 'default' : 'outline'}
                onClick={() => {
                  setChainId(c.id)
                  setShowSpam(false)
                }}
              >
                {c.name}
              </Button>
            ))}
        </div>
      </CardHeader>
      <CardContent>
        {nfts.isLoading ? (
          <p className="text-muted-foreground py-6 text-center text-sm">Loading NFTs…</p>
        ) : nfts.isError ? (
          <p className="text-destructive py-6 text-center text-sm">Couldn’t load NFTs from the explorer right now.</p>
        ) : all.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">No NFTs on {chain?.name}.</p>
        ) : (
          <>
            {real.length > 0 && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {real.slice(0, PAGE).map((n) => (
                  <NftTile key={n.key} n={n} explorer={chain?.blockExplorers?.default.url} />
                ))}
              </div>
            )}
            {spam.length > 0 && (
              <div className="mt-4 border-t pt-3">
                <button
                  onClick={() => setShowSpam((v) => !v)}
                  className="text-muted-foreground flex w-full items-center gap-2 text-sm"
                  aria-expanded={showSpam}
                >
                  <EyeOff className="size-4" />
                  {spam.length} spam NFT{spam.length === 1 ? '' : 's'} hidden — images not loaded
                  <ChevronDown className={cn('ml-auto size-4 transition-transform', showSpam && 'rotate-180')} />
                </button>
                {showSpam && (
                  <div className="mt-3 grid grid-cols-2 gap-4 opacity-80 sm:grid-cols-3 lg:grid-cols-4">
                    {spam.slice(0, PAGE).map((n) => (
                      <NftTile key={n.key} n={n} dim />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
