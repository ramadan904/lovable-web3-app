import type { Address } from 'viem'
import { useChains, useWaitForTransactionReceipt } from 'wagmi'
import { ArrowUpRight, CircleCheck, CircleX, Loader } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useActivity, type ActivityItem } from '@/lib/activity'
import { navigate } from '@/lib/route'
import { shortenAddress } from '@/lib/utils'
import type { ChainId } from '@/lib/wagmi'

function StatusIcon({ item }: { item: ActivityItem }) {
  const receipt = useWaitForTransactionReceipt({ hash: item.hash, chainId: item.chainId as ChainId })
  if (receipt.data?.status === 'success')
    return <CircleCheck className="size-4 text-emerald-600" aria-label="Confirmed" />
  if (receipt.data?.status === 'reverted' || receipt.isError)
    return <CircleX className="text-destructive size-4" aria-label="Failed" />
  return <Loader className="text-muted-foreground size-4 animate-spin" aria-label="Pending" />
}

export function ActivityCard({ address }: { address: Address }) {
  const items = useActivity(address)
  const chains = useChains()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
        <CardDescription>Transactions you've sent from this app in this browser.</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Nothing yet. Transfers you send will show up here.
          </p>
        ) : (
          <ul className="divide-y">
            {items.map((item) => {
              const chain = chains.find((c) => c.id === item.chainId)
              const explorer = chain?.blockExplorers?.default.url
              return (
                <li key={item.hash} className="flex items-center gap-3 py-3 text-sm">
                  <StatusIcon item={item} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {item.amount} {item.token === 'ETH' ? (chain?.nativeCurrency.symbol ?? 'ETH') : item.token}{' '}
                      <span className="text-muted-foreground font-normal">
                        to <span className="font-mono">{shortenAddress(item.to)}</span>
                      </span>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {chain?.name ?? `Chain ${item.chainId}`} · {new Date(item.time).toLocaleString()} ·{' '}
                      <button
                        className="underline underline-offset-4"
                        onClick={() => navigate({ view: 'tx', target: item.hash })}
                      >
                        explain
                      </button>
                    </p>
                  </div>
                  {explorer && (
                    <a
                      href={`${explorer}/tx/${item.hash}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="View on explorer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ArrowUpRight className="size-4" />
                    </a>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
