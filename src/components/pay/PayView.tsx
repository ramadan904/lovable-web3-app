import { isAddress } from 'viem'
import { useChains, useConnection, useEnsName, useSwitchChain } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { HandCoins, ShieldCheck } from 'lucide-react'

import { ConnectCard } from '@/components/ConnectCard'
import { SendCard } from '@/components/dashboard/SendCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { readPayRequest } from '@/lib/payLink'
import { shortenAddress } from '@/lib/utils'

export function PayView({ params }: { params?: URLSearchParams }) {
  const chains = useChains()
  const { status, chain } = useConnection()
  const switchChain = useSwitchChain()
  const request = readPayRequest(
    params,
    chains.map((c) => c.id),
  )
  const toAddress = request && isAddress(request.to) ? request.to : undefined
  const ensName = useEnsName({ address: toAddress, chainId: mainnet.id, query: { enabled: !!toAddress } })

  if (!request)
    return (
      <p className="text-destructive rounded-xl border border-dashed p-10 text-center text-sm">
        This payment link is incomplete or invalid. Ask the sender for a new one.
      </p>
    )

  const target = chains.find((c) => c.id === request.chainId)!
  const who = ensName.data ?? (toAddress ? shortenAddress(toAddress) : request.to)

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <Card className="gap-0 overflow-hidden py-0">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-500 p-6 text-white">
          <p className="flex items-center gap-2 text-sm font-medium opacity-90">
            <HandCoins className="size-4" /> Payment request
          </p>
          <p className="mt-2 text-4xl font-extrabold">
            {request.amount} {request.token}
          </p>
          <p className="mt-1 opacity-90">
            to <span className="font-mono font-semibold">{who}</span> on {target.name}
          </p>
          {request.note && <p className="mt-3 rounded-md bg-white/15 px-3 py-2 text-sm">“{request.note}”</p>}
        </div>
        <CardContent className="flex flex-col gap-2 py-4 text-sm">
          <p className="text-muted-foreground">Full recipient address — check it matches what you expect:</p>
          <p className="bg-muted rounded-md p-2 font-mono text-xs break-all">{request.to}</p>
          <p className="text-muted-foreground flex items-center gap-2 text-xs">
            <ShieldCheck className="size-4 shrink-0 text-emerald-600" /> Scam Shield checks the recipient before you
            sign. Only pay requests from people you trust.
          </p>
        </CardContent>
      </Card>

      {status !== 'connected' ? (
        <div className="flex justify-center">
          <ConnectCard />
        </div>
      ) : (
        <>
          {chain?.id !== target.id && (
            <Button onClick={() => switchChain.mutate({ chainId: target.id })} disabled={switchChain.isPending}>
              Switch to {target.name} to pay
            </Button>
          )}
          <SendCard title="Review & pay" initial={{ to: request.to, amount: request.amount, token: request.token, chainId: request.chainId }} />
        </>
      )}
    </div>
  )
}
