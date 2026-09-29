import { encodeFunctionData, erc20Abi, getAddress, isAddress, parseEther, parseUnits, type Address } from 'viem'
import { normalize } from 'viem/ens'
import { mainnet } from 'wagmi/chains'
import { getPublicClient } from 'wagmi/actions'

import type { Contact } from '@/lib/contacts'
import { assessRecipient, findLookalike, type Finding } from '@/lib/shield'
import { simulate, type Simulation } from '@/lib/simulate'
import { USDC, USDC_DECIMALS } from '@/lib/tokens'
import { config, type ChainId } from '@/lib/wagmi'

/**
 * The Threshold: the pause before you sign. Runs the same checks as the Send
 * flow — who the recipient is, what the chain knows about them, whether they
 * imitate someone you trust, and a simulation — one visible step at a time.
 */

export type StepId = 'resolve' | 'read' | 'compare' | 'simulate'
export type Tone = 'ok' | 'caution' | 'stop'
export type Step = {
  status: 'waiting' | 'running' | 'done'
  tone?: Tone
  headline?: string
  detail?: string
}
export type Verdict = {
  tone: Tone
  title: string
  reasons: string[]
  to?: Address
  lookalikeOf?: Address
  sim?: Simulation
}

export type ThresholdInput = {
  to: string
  amount: string
  token: 'ETH' | 'USDC'
  chainId: number
  chainName: string
  /** Connected wallet; absent means the demo wallet. */
  from?: Address
  known: Address[]
  knownNames?: Record<string, string>
  contacts?: Contact[]
}

/** A made-up sender for people without a wallet; simulations give it 100 of the native coin. */
export const DEMO_WALLET: Address = getAddress('0xde30000000000000000000000000000000000b0d')
export const DEMO_FUNDS = parseEther('100')

const MIN_STEP_MS = 650
const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
const client = (chainId: number) => getPublicClient(config, { chainId: chainId as ChainId })

/** An address that starts and ends like `real` but differs in the middle — what poisoners generate. */
export function lookalikeOf(real: Address): Address {
  const hex = real.slice(2).toLowerCase()
  const middle = [...hex.slice(4, -4)].map((c) => ((parseInt(c, 16) + 7) % 16).toString(16)).join('')
  return getAddress(`0x${hex.slice(0, 4)}${middle}${hex.slice(-4)}`)
}

function parseAmount(amount: string, token: 'ETH' | 'USDC') {
  try {
    const v = token === 'ETH' ? parseEther(amount) : parseUnits(amount, USDC_DECIMALS)
    return v > 0n ? v : undefined
  } catch {
    return undefined
  }
}

const worst = (tones: (Tone | undefined)[]): Tone =>
  tones.includes('stop') ? 'stop' : tones.includes('caution') ? 'caution' : 'ok'
const toneOf = (f: Finding): Tone => (f.level === 'danger' ? 'stop' : f.level === 'warning' ? 'caution' : 'ok')

export async function runThreshold(
  input: ThresholdInput,
  onStep: (id: StepId, step: Step) => void,
  isCancelled: () => boolean,
): Promise<Verdict | undefined> {
  const pace = async (started: number) => {
    if (!reducedMotion()) await sleep(Math.max(0, MIN_STEP_MS - (Date.now() - started)))
    return isCancelled()
  }
  const reasons: string[] = []
  const tones: Tone[] = []
  const done = (id: StepId, tone: Tone, headline: string, detail?: string) => {
    tones.push(tone)
    if (tone !== 'ok') reasons.push(detail ? `${headline} — ${detail}` : headline)
    onStep(id, { status: 'done', tone, headline, detail })
  }

  // 1. Who is this?
  let t = Date.now()
  onStep('resolve', { status: 'running', headline: 'Finding who you’re paying' })
  const raw = input.to.trim()
  let to: Address | undefined
  let name: string | undefined
  if (isAddress(raw)) to = getAddress(raw)
  else if (raw.includes('.')) {
    try {
      name = normalize(raw)
      to = (await client(mainnet.id)?.getEnsAddress({ name })) ?? undefined
    } catch {
      to = undefined
    }
  }
  if (await pace(t)) return
  if (!to) {
    done('resolve', 'stop', name ? `${name} doesn’t point to an address` : 'That isn’t a valid address or ENS name')
    return { tone: 'stop', title: 'Stop. There’s no one to pay.', reasons }
  }
  done('resolve', 'ok', name ? `${name} → ${short(to)}` : `Well-formed address ${short(to)}`, 'Checksum verified')

  // 2. What does the chain know about them?
  t = Date.now()
  onStep('read', { status: 'running', headline: `Reading this address on ${input.chainName}` })
  const c = client(input.chainId)
  const [code, nonce, balance] = await Promise.allSettled([
    c?.getCode({ address: to }),
    c?.getTransactionCount({ address: to }),
    c?.getBalance({ address: to }),
  ])
  const onChain =
    code.status === 'fulfilled'
      ? {
          code: code.value ?? '0x',
          nonce: nonce.status === 'fulfilled' ? nonce.value : undefined,
          balance: balance.status === 'fulfilled' ? balance.value : undefined,
        }
      : undefined
  const findings = assessRecipient({
    to,
    chainName: input.chainName,
    token: input.token,
    self: input.from,
    known: input.known,
    contacts: input.contacts,
    onChain,
  })
  if (await pace(t)) return
  const lookalike = findLookalike(to, input.from ? [input.from, ...input.known] : input.known)
  const readFindings = findings.filter(
    (f) => !f.title.startsWith('Look-alike') && !/sent to this|Saved contact/.test(f.title),
  )
  if (!onChain)
    done('read', 'caution', `Couldn’t reach ${input.chainName}`, 'The address couldn’t be checked right now')
  else {
    const top = readFindings.sort((a, b) => toneRank(toneOf(b)) - toneRank(toneOf(a)))[0]
    done('read', top ? toneOf(top) : 'ok', top?.title ?? 'An ordinary wallet', top?.detail)
  }

  // 3. Is it pretending to be someone you trust?
  t = Date.now()
  onStep('compare', { status: 'running', headline: 'Comparing with addresses you trust' })
  if (await pace(t)) return
  const trusted = findings.find((f) => /sent to this|Saved contact/.test(f.title))
  if (lookalike) {
    const who = input.knownNames?.[lookalike.toLowerCase()] ?? short(lookalike)
    done('compare', 'stop', `Imitates ${who}`, 'Same start and end, different middle: an address-poisoning trap')
  } else if (trusted) done('compare', 'ok', trusted.title)
  else
    done(
      'compare',
      'ok',
      'Not imitating anyone you’ve paid',
      `${input.known.length} trusted address${input.known.length === 1 ? '' : 'es'} checked`,
    )

  // 4. What would actually happen?
  t = Date.now()
  onStep('simulate', { status: 'running', headline: `Simulating on ${input.chainName}` })
  const units = parseAmount(input.amount, input.token)
  let sim: Simulation | undefined
  if (units === undefined) {
    if (await pace(t)) return
    done('simulate', 'stop', 'Enter an amount above zero')
  } else {
    const usdc = USDC[input.chainId]
    const call =
      input.token === 'ETH'
        ? { to, value: units }
        : { to: usdc, data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [to, units] }) }
    sim = await simulate(input.chainId, input.from ?? DEMO_WALLET, [call], input.from ? undefined : DEMO_FUNDS)
    if (await pace(t)) return
    if (sim.status === 'revert')
      done(
        'simulate',
        'stop',
        'This transaction would fail',
        /insufficient funds|exceeds the balance|exceeds balance/i.test(sim.reason)
          ? `Not enough ${input.token} to cover the amount plus the network fee — you’d pay a fee for nothing`
          : sim.reason,
      )
    else if (sim.status === 'unavailable')
      done('simulate', 'caution', 'Couldn’t simulate right now', 'Check the details in your wallet carefully')
    else {
      const out = sim.movements.filter((m) => m.direction === 'out')
      const extra = out.filter((m) => m.counterparty.toLowerCase() !== to.toLowerCase())
      if (extra.length || sim.approvals.some((a) => !a.revoke))
        done('simulate', 'stop', 'It moves more than you asked for', 'Funds or permissions go to someone else too')
      else
        done(
          'simulate',
          'ok',
          `Succeeds — only ${input.amount} ${input.token} leaves, to ${name ?? short(to)}`,
          sim.engine === 'simulate' ? 'Executed against the latest block' : 'Dry run against the latest block',
        )
    }
  }

  const tone = worst(tones)
  return {
    tone,
    title:
      tone === 'stop' ? 'Stop. Don’t sign this.' : tone === 'caution' ? 'Pause. Read this first.' : 'Clear to sign.',
    reasons,
    to,
    lookalikeOf: lookalike,
    sim,
  }
}

const toneRank = (t: Tone) => (t === 'stop' ? 2 : t === 'caution' ? 1 : 0)
