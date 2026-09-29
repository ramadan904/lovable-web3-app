import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Address } from 'viem'
import { useChains, useConnection, useSwitchChain } from 'wagmi'
import { base } from 'wagmi/chains'
import { ArrowRight, Check, Loader, OctagonX, RotateCcw, TriangleAlert } from 'lucide-react'

import { AddressDiff } from '@/components/AddressDiff'
import { HoldButton } from '@/components/HoldButton'
import { useActivity } from '@/lib/activity'
import { chainLabel } from '@/lib/chains'
import { useContacts } from '@/lib/contacts'
import { navigate } from '@/lib/route'
import { fillSendDraft } from '@/lib/sendDraft'
import { lookalikeOf, runThreshold, type Step, type StepId, type Tone, type Verdict } from '@/lib/threshold'
import { USDC } from '@/lib/tokens'
import { cn } from '@/lib/utils'

const VITALIK: Address = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'

const STEPS: { id: StepId; n: string; label: string }[] = [
  { id: 'resolve', n: '01', label: 'Recipient' },
  { id: 'read', n: '02', label: 'On-chain record' },
  { id: 'compare', n: '03', label: 'Look-alike check' },
  { id: 'simulate', n: '04', label: 'Simulation' },
]

const TONE_TEXT: Record<Tone, string> = { ok: 'text-emerald-300', caution: 'text-amber-300', stop: 'text-rose-400' }
const TONE_RING: Record<Tone, string> = {
  ok: 'border-emerald-400/60 bg-emerald-400/10',
  caution: 'border-amber-300/60 bg-amber-300/10',
  stop: 'border-rose-400/70 bg-rose-500/15',
}
const TONE_PANEL: Record<Tone, string> = {
  ok: 'border-emerald-400/25 from-emerald-400/10',
  caution: 'border-amber-300/25 from-amber-300/10',
  stop: 'border-rose-400/30 from-rose-500/15',
}

type Scenario = { id: string; label: string; to: (chainId: number) => string; amount: string }
const SCENARIOS: Scenario[] = [
  { id: 'friend', label: 'Pay a friend', to: () => 'vitalik.eth', amount: '0.05' },
  { id: 'poison', label: 'Poisoned look-alike', to: () => lookalikeOf(VITALIK), amount: '0.05' },
  { id: 'token', label: 'Send to a token contract', to: (id) => USDC[id], amount: '0.05' },
  { id: 'broke', label: 'More than you have', to: () => 'vitalik.eth', amount: '250' },
]

const idle = (): Record<StepId, Step> => ({
  resolve: { status: 'waiting' },
  read: { status: 'waiting' },
  compare: { status: 'waiting' },
  simulate: { status: 'waiting' },
})

function StepIcon({ step }: { step: Step }) {
  if (step.status === 'running') return <Loader className="size-3.5 animate-spin text-zinc-200" />
  if (step.status === 'waiting') return null
  if (step.tone === 'stop') return <OctagonX className="size-3.5 text-rose-400" />
  if (step.tone === 'caution') return <TriangleAlert className="size-3.5 text-amber-300" />
  return <Check className="size-3.5 text-emerald-300" />
}

/**
 * The Threshold: the pause before you sign, as a live ritual anyone can run.
 * Without a wallet it runs as a demo wallet; with one, it checks as you and
 * hands off to the real review-and-sign flow.
 */
export function Threshold() {
  const { address, status, chain } = useConnection()
  const connected = status === 'connected' && !!address
  const chains = useChains()
  const switchChain = useSwitchChain()
  const contacts = useContacts()
  const history = useActivity(address ?? '0x0000000000000000000000000000000000000000')

  const [chainId, setChainId] = useState<number>(() => chain?.id ?? base.id)
  const [to, setTo] = useState('vitalik.eth')
  const [amount, setAmount] = useState('0.05')
  const [token, setToken] = useState<'ETH' | 'USDC'>('ETH')
  const [demo, setDemo] = useState(!connected)
  const [steps, setSteps] = useState(idle)
  const [verdict, setVerdict] = useState<Verdict>()
  const [running, setRunning] = useState(false)
  const [activeScenario, setActiveScenario] = useState<string>()
  const runId = useRef(0)
  const root = useRef<HTMLElement>(null)
  const verdictRef = useRef<HTMLDivElement>(null)

  const target = chains.find((c) => c.id === chainId) ?? chains[0]

  async function run(next: { to: string; amount: string; chainId: number; token: 'ETH' | 'USDC'; demo: boolean }) {
    const id = ++runId.current
    setSteps(idle())
    setVerdict(undefined)
    setRunning(true)
    const c = chains.find((x) => x.id === next.chainId) ?? chains[0]
    const asDemo = next.demo || !connected
    const known: Address[] = asDemo
      ? [VITALIK]
      : [...new Set([...contacts.map((x) => x.address), ...history.map((h) => h.to)])]
    const knownNames: Record<string, string> = asDemo
      ? { [VITALIK.toLowerCase()]: 'vitalik.eth' }
      : Object.fromEntries(contacts.map((x) => [x.address.toLowerCase(), x.name]))
    const result = await runThreshold(
      {
        ...next,
        chainName: chainLabel(c),
        from: asDemo ? undefined : address,
        known,
        knownNames,
        contacts: asDemo ? [] : contacts,
      },
      (stepId, step) => id === runId.current && setSteps((s) => ({ ...s, [stepId]: step })),
      () => id !== runId.current,
    )
    if (id !== runId.current) return
    setVerdict(result)
    setRunning(false)
  }

  function runScenario(s: Scenario) {
    const next = { to: s.to(chainId), amount: s.amount, chainId, token: 'ETH' as const, demo: true }
    setActiveScenario(s.id)
    setTo(next.to)
    setAmount(next.amount)
    setToken('ETH')
    setDemo(true)
    void run(next)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setActiveScenario(undefined)
    void run({ to, amount, chainId, token, demo })
  }

  // Run the most telling scenario once, the first time the section scrolls into view.
  const autoRan = useRef(false)
  useEffect(() => {
    const el = root.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || autoRan.current) return
        autoRan.current = true
        io.disconnect()
        runScenario(SCENARIOS[1])
      },
      { threshold: 0.35 },
    )
    io.observe(el)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per mount
  }, [])

  useEffect(() => {
    if (verdict) verdictRef.current?.focus({ preventScroll: true })
  }, [verdict])

  function continueToSign() {
    if (!verdict?.to) return
    if (chain?.id !== chainId) switchChain.mutate({ chainId: chainId as (typeof chains)[number]['id'] })
    navigate({ view: 'dashboard' })
    setTimeout(() => fillSendDraft({ to: verdict.to, amount, token }), 60)
  }

  const asDemo = demo || !connected
  const inputClass =
    'h-11 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-white/30 focus:bg-white/[0.07]'

  return (
    <section
      ref={root}
      id="threshold"
      aria-labelledby="threshold-title"
      className="threshold relative isolate scroll-mt-20 overflow-hidden rounded-3xl bg-[#08080c] p-5 text-zinc-100 shadow-2xl ring-1 ring-white/10 sm:p-8"
    >
      <div aria-hidden className="threshold-glow pointer-events-none absolute inset-0 -z-10" />
      <div className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-[0.25em] text-zinc-500 uppercase">01 · The threshold</p>
        <h2 id="threshold-title" className="font-display text-3xl leading-tight tracking-tight sm:text-4xl">
          Try to get a bad transaction past it.
        </h2>
        <p className="max-w-2xl text-sm text-zinc-400">
          Four checks between you and an irreversible mistake — run live against the chain, in about three seconds.{' '}
          {asDemo
            ? 'No wallet needed: this uses a demo wallet holding 100 simulated ETH, which has paid vitalik.eth before.'
            : 'Checking as your connected wallet.'}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Try a scenario">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => runScenario(s)}
            aria-pressed={activeScenario === s.id}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition',
              activeScenario === s.id
                ? 'border-white/60 bg-white text-zinc-900'
                : 'border-white/15 text-zinc-300 hover:border-white/35 hover:text-white',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-[1fr_9rem_auto]">
        <label className="grid gap-1">
          <span className="text-[11px] tracking-wider text-zinc-500 uppercase">Pay</span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value.trim())}
            placeholder="0x… or name.eth"
            className={cn(inputClass, 'font-mono')}
            autoComplete="off"
            spellCheck={false}
            aria-label="Recipient address or ENS name"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-[11px] tracking-wider text-zinc-500 uppercase">Amount</span>
          <div className="relative">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.trim())}
              inputMode="decimal"
              className={cn(inputClass, 'pr-14 tabular-nums')}
              aria-label="Amount"
            />
            <button
              type="button"
              disabled={asDemo}
              onClick={() => setToken((t) => (t === 'ETH' ? 'USDC' : 'ETH'))}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded px-1.5 py-0.5 text-xs font-semibold text-zinc-300 enabled:hover:bg-white/10"
              aria-label={`Token: ${token}${asDemo ? '' : ', click to switch'}`}
            >
              {token === 'ETH' ? (target?.nativeCurrency.symbol ?? 'ETH') : 'USDC'}
            </button>
          </div>
        </label>
        <div className="grid gap-1 sm:self-end">
          <button
            type="submit"
            disabled={running || !to}
            className="flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200 disabled:opacity-50"
          >
            {running ? <Loader className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
            {running ? 'Checking…' : 'Check before signing'}
          </button>
        </div>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-500">
        <div className="chip-row flex-1 !gap-1" role="group" aria-label="Network">
          {chains.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setChainId(c.id)}
              aria-pressed={c.id === chainId}
              className={cn(
                'rounded-md px-2 py-1 transition',
                c.id === chainId ? 'bg-white/10 text-zinc-100' : 'hover:text-zinc-300',
              )}
            >
              {chainLabel(c)}
            </button>
          ))}
        </div>
        {connected && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
            Use the demo wallet
          </label>
        )}
      </div>

      <ol className="mt-6 grid gap-0 sm:grid-cols-4 sm:gap-3" aria-live="polite">
        {STEPS.map((s, i) => {
          const step = steps[s.id]
          const settled = step.status === 'done'
          return (
            <li
              key={s.id}
              className={cn(
                'relative flex gap-3 pb-5 sm:flex-col sm:gap-2 sm:rounded-xl sm:border sm:border-white/[0.06] sm:bg-white/[0.02] sm:p-4',
                step.status === 'waiting' && 'opacity-45',
              )}
            >
              {/* rail between steps (mobile) */}
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute top-8 bottom-0 left-[15px] w-px sm:hidden',
                    settled ? 'bg-white/25' : 'bg-white/[0.07]',
                  )}
                />
              )}
              <span
                className={cn(
                  'relative flex size-8 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] transition-colors duration-500',
                  settled && step.tone ? TONE_RING[step.tone] : 'border-white/15',
                  step.status === 'running' && 'threshold-pulse border-white/40',
                )}
              >
                {step.status === 'waiting' || step.status === 'running' ? s.n : <StepIcon step={step} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[11px] tracking-wider text-zinc-500 uppercase">
                  {s.label}
                  {step.status === 'running' && <StepIcon step={step} />}
                </p>
                <p
                  key={`${step.status}:${step.headline}`}
                  className={cn(
                    'mt-0.5 text-sm break-words',
                    settled && step.tone ? TONE_TEXT[step.tone] : 'text-zinc-300',
                    settled && 'animate-rise',
                  )}
                >
                  {step.headline ?? '—'}
                </p>
                {step.detail && <p className="mt-0.5 text-xs break-words text-zinc-500">{step.detail}</p>}
              </div>
            </li>
          )
        })}
      </ol>

      {verdict && (
        <div
          ref={verdictRef}
          tabIndex={-1}
          role="status"
          className={cn(
            'animate-rise mt-2 rounded-2xl border bg-gradient-to-br to-transparent p-5 outline-none sm:p-6',
            TONE_PANEL[verdict.tone],
          )}
        >
          <p className="text-[11px] tracking-[0.3em] text-zinc-500 uppercase">Verdict</p>
          <p
            className={cn(
              'font-display mt-1 text-4xl leading-tight tracking-tight sm:text-5xl',
              TONE_TEXT[verdict.tone],
            )}
          >
            {verdict.title}
          </p>
          {verdict.reasons.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1 text-sm text-zinc-300">
              {verdict.reasons.map((r) => (
                <li key={r}>· {r}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-zinc-400">
              Nothing here looks wrong. Your wallet will still ask you to confirm — this is the part it can’t tell you.
            </p>
          )}

          {verdict.lookalikeOf && verdict.to && (
            <div className="mt-4 grid gap-2 rounded-xl border border-white/10 bg-black/30 p-4 text-xs">
              <p className="text-zinc-500">You pasted</p>
              <AddressDiff
                fake={verdict.to}
                real={verdict.lookalikeOf}
                className="text-[13px] text-zinc-300"
                highlight="rounded-sm bg-rose-500/30 text-rose-200"
              />
              <p className="mt-1 text-zinc-500">You meant ({asDemo ? 'vitalik.eth' : 'an address you trust'})</p>
              <span className="font-mono text-[13px] break-all text-zinc-300">{verdict.lookalikeOf}</span>
              <p className="mt-1 text-zinc-500">
                Scammers send you dust from an address like this so it shows up in your history. Wallets shorten
                addresses to the first and last characters — exactly the part they copy.
              </p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {connected && !asDemo && verdict.to && verdict.tone === 'stop' ? (
              <HoldButton onComplete={continueToSign}>Hold to continue anyway</HoldButton>
            ) : connected && !asDemo && verdict.to ? (
              <button
                type="button"
                onClick={continueToSign}
                className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200"
              >
                Continue to review & sign
                <ArrowRight className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (connected) {
                    setDemo(false)
                    setActiveScenario(undefined)
                    void run({ to, amount, chainId, token, demo: false })
                  } else document.getElementById('connect')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }}
                className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200"
              >
                {connected ? 'Check as my wallet' : 'Connect to protect your own sends'}
                <ArrowRight className="size-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                runScenario(SCENARIOS[(SCENARIOS.findIndex((s) => s.id === activeScenario) + 1) % SCENARIOS.length])
              }
              className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100"
            >
              <RotateCcw className="size-3.5" /> Try another scenario
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
