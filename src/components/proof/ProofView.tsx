import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useConnection, useEnsName, useSignMessage } from 'wagmi'
import { verifyMessage } from 'wagmi/actions'
import { arbitrum, base, mainnet, optimism, polygon } from 'wagmi/chains'
import { QRCodeSVG } from 'qrcode.react'
import { BadgeCheck, Check, Copy, Fingerprint, Loader, ShieldX, TriangleAlert } from 'lucide-react'

import { ConnectCard } from '@/components/ConnectCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { buildProofLink, buildProofMessage, readProof, signedAt, type Proof } from '@/lib/proof'
import { navigate } from '@/lib/route'
import { shortenAddress } from '@/lib/utils'
import { config } from '@/lib/wagmi'
import { celebrate } from '@/lib/celebrate'

function CreateProof() {
  const { address, status } = useConnection()
  const sign = useSignMessage()
  const [purpose, setPurpose] = useState('')
  const [proof, setProof] = useState<Proof>()
  const [copied, setCopied] = useState(false)

  if (status !== 'connected' || !address)
    return (
      <div className="flex justify-center">
        <ConnectCard />
      </div>
    )

  const link = proof ? buildProofLink(proof) : undefined

  function create() {
    const message = buildProofMessage(address!, purpose)
    sign.mutate(
      { message },
      {
        onSuccess: (signature) => {
          setProof({ address: address!, message, signature })
          celebrate()
        },
      },
    )
  }

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <Card className="mx-auto w-full max-w-lg">
      <CardHeader>
        <CardTitle>Create a proof</CardTitle>
        <CardDescription>
          Signing a message is free, sends no transaction and can’t move your funds. It only proves you hold this
          wallet’s key.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="proof-for">Who is this for? (optional)</Label>
          <Input
            id="proof-for"
            placeholder="e.g. @alice on Telegram — OTC trade #42"
            maxLength={120}
            value={purpose}
            onChange={(e) => {
              setPurpose(e.target.value)
              setProof(undefined)
            }}
          />
          <p className="text-muted-foreground text-xs">
            Tip: include a word the other person gave you, so they know the proof is fresh.
          </p>
        </div>
        <Button onClick={create} disabled={sign.isPending}>
          <Fingerprint /> {sign.isPending ? 'Sign in your wallet…' : 'Sign & create link'}
        </Button>
        {sign.error && (
          <p className="text-destructive text-sm">
            {'shortMessage' in sign.error ? String(sign.error.shortMessage) : sign.error.message}
          </p>
        )}
        {proof && link && (
          <div className="flex flex-col items-center gap-3 rounded-lg border p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-600">
              <BadgeCheck className="size-4" /> Proof ready — share the link
            </p>
            <div className="rounded-lg bg-white p-2">
              <QRCodeSVG value={link} size={160} bgColor="#ffffff" fgColor="#000000" />
            </div>
            <pre className="bg-muted w-full rounded-md p-3 text-xs whitespace-pre-wrap">{proof.message}</pre>
            <div className="flex w-full gap-2">
              <Button className="flex-1" variant="outline" onClick={copy}>
                {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy link'}
              </Button>
              <Button className="flex-1" variant="outline" asChild>
                <a href={link} target="_blank" rel="noreferrer">
                  Preview
                </a>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function VerifyProof({ proof }: { proof: Proof }) {
  const ens = useEnsName({ address: proof.address, chainId: mainnet.id })
  // EOAs verify offline; smart wallets (ERC-1271 / ERC-6492) need a chain, so try each mainnet in turn.
  const check = useQuery({
    queryKey: ['verify', proof.address, proof.signature, proof.message],
    retry: false,
    queryFn: async () => {
      for (const chainId of [mainnet.id, base.id, arbitrum.id, optimism.id, polygon.id]) {
        try {
          if (await verifyMessage(config, { ...proof, chainId })) return true
        } catch {
          // try next chain
        }
      }
      return false
    },
  })
  const at = signedAt(proof.message)
  const [openedAt] = useState(() => Date.now())
  const ageDays = at ? (openedAt - at.getTime()) / 86_400_000 : undefined

  return (
    <Card className="mx-auto w-full max-w-lg gap-0 overflow-hidden py-0">
      <div
        className={
          check.data === true
            ? 'bg-gradient-to-br from-emerald-600 to-teal-500 p-6 text-white'
            : check.data === false
              ? 'bg-gradient-to-br from-red-700 to-rose-500 p-6 text-white'
              : 'bg-muted p-6'
        }
      >
        {check.isLoading ? (
          <p className="flex items-center gap-2 font-medium">
            <Loader className="size-5 animate-spin" /> Checking signature…
          </p>
        ) : check.data ? (
          <>
            <p className="flex items-center gap-2 text-2xl font-extrabold">
              <BadgeCheck className="size-7" /> Verified owner
            </p>
            <p className="mt-2 opacity-90">
              This message was signed by the key that controls{' '}
              <span className="font-mono font-semibold">{ens.data ?? shortenAddress(proof.address)}</span>.
            </p>
          </>
        ) : (
          <>
            <p className="flex items-center gap-2 text-2xl font-extrabold">
              <ShieldX className="size-7" /> Not verified
            </p>
            <p className="mt-2 opacity-90">The signature doesn’t match this wallet. Don’t trust this proof.</p>
          </>
        )}
      </div>
      <CardContent className="flex flex-col gap-3 py-5 text-sm">
        <div>
          <p className="text-muted-foreground mb-1 text-xs">Wallet</p>
          <p className="bg-muted rounded-md p-2 font-mono text-xs break-all">{proof.address}</p>
        </div>
        <div>
          <p className="text-muted-foreground mb-1 text-xs">Signed message</p>
          <pre className="bg-muted rounded-md p-3 text-xs whitespace-pre-wrap">{proof.message}</pre>
        </div>
        {check.data && ageDays !== undefined && ageDays > 7 && (
          <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
            <TriangleAlert className="mt-px size-4 shrink-0" />
            Signed {Math.floor(ageDays)} days ago. If this matters, ask for a fresh proof that includes a word you
            choose.
          </p>
        )}
        <Button variant="outline" onClick={() => navigate({ view: 'prove' })}>
          <Fingerprint /> Create your own proof
        </Button>
      </CardContent>
    </Card>
  )
}

export function ProofView({ params, mode }: { params?: URLSearchParams; mode: 'prove' | 'verify' }) {
  const proof = mode === 'verify' ? readProof(params) : null
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display flex items-center gap-2.5 text-3xl tracking-tight sm:text-4xl">
          <Fingerprint className="text-primary size-6" /> Proof of ownership
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Prove you own a wallet without sending a cent. Anyone with the link can check it — the math runs in their
          browser.
        </p>
      </div>
      {mode === 'prove' ? (
        <CreateProof />
      ) : proof ? (
        <VerifyProof proof={proof} />
      ) : (
        <p className="text-destructive rounded-xl border border-dashed p-10 text-center text-sm">
          This proof link is broken or incomplete.
        </p>
      )}
    </div>
  )
}
