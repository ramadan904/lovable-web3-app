import { useQuery } from '@tanstack/react-query'
import {
  BaseError,
  decodeEventLog,
  decodeFunctionData,
  erc20Abi,
  maxUint256,
  parseAbi,
  zeroAddress,
  type Address,
  type Hex,
  type Log,
} from 'viem'
import { getPublicClient } from 'wagmi/actions'

import { USDC, USDC_DECIMALS } from '@/lib/tokens'
import { config, type ChainId } from '@/lib/wagmi'

/**
 * Transaction preview: runs the calls against current chain state before the
 * wallet is asked to sign, and reports what would move in plain terms.
 *
 * 1. `eth_simulateV1` (free on most RPCs) — real execution, including token
 *    transfers and approvals emitted by the contracts involved.
 * 2. If the RPC doesn't support it, a gas estimate (dry run) catches reverts,
 *    and the preview is built from the transaction data itself.
 */

/** A call to simulate; no `to` means a contract deployment. */
export type SimCall = { to?: Address; data?: Hex; value?: bigint }

export type TokenInfo = { address: Address | 'native'; symbol: string; decimals: number }

export type Movement = {
  direction: 'out' | 'in'
  token: TokenInfo
  /** Token amount, or the NFT id when `nft` is true. */
  amount: bigint
  nft?: boolean
  counterparty: Address
  /** ETH sent into a contract this transaction creates. */
  toNewContract?: boolean
}

export type ApprovalChange = {
  token: TokenInfo
  spender: Address
  /** `all` = every NFT in the collection (setApprovalForAll). */
  amount: bigint | 'all'
  revoke: boolean
}

export type Simulation =
  | {
      status: 'success'
      /** `simulate` = executed with eth_simulateV1; `estimate` = dry run + decoded calldata. */
      engine: 'simulate' | 'estimate'
      gasUsed: bigint
      movements: Movement[]
      approvals: ApprovalChange[]
    }
  | { status: 'revert'; reason: string }
  | { status: 'unavailable'; reason: string }

// eth_simulateV1 with traceTransfers reports native ETH moves as Transfer logs from this address.
const NATIVE_LOG_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
export const UNLIMITED = maxUint256 / 2n

const eventsAbi = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
  'event ApprovalForAll(address indexed owner, address indexed operator, bool approved)',
])
const nftEventsAbi = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)',
])
const callsAbi = parseAbi([
  'function transfer(address to, uint256 amount)',
  'function transferFrom(address from, address to, uint256 amount)',
  'function approve(address spender, uint256 amount)',
  'function setApprovalForAll(address operator, bool approved)',
])

const clientFor = (chainId: number) => getPublicClient(config, { chainId: chainId as ChainId })
const same = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase()

function reasonOf(error: unknown) {
  let text = error instanceof Error ? error.message : String(error)
  if (error instanceof BaseError) text = (error.walk() as { reason?: string }).reason || error.shortMessage
  // "The contract function "<unknown>" reverted with the following reason: X" → "X"
  return text.replace(/^[\s\S]*reverted with the following reason:\s*/, '').trim() || 'The transaction reverted'
}

/** Reverts and balance problems are answers; anything else means the RPC couldn't answer. */
const isRevert = (error: unknown) =>
  /revert|insufficient funds|exceeds balance|out of gas|invalid opcode/i.test(
    error instanceof BaseError ? `${error.shortMessage} ${error.details}` : String(error),
  )

type RawMovement = Omit<Movement, 'token'> & { token: Address | 'native' }
type RawApproval = Omit<ApprovalChange, 'token'> & { token: Address }

function fromLogs(logs: Log[], account: Address) {
  const movements: RawMovement[] = []
  const approvals: RawApproval[] = []
  for (const log of logs) {
    const native = same(log.address, NATIVE_LOG_ADDRESS)
    const nft = log.topics.length === 4
    let event
    try {
      event = decodeEventLog({ abi: nft ? nftEventsAbi : eventsAbi, data: log.data, topics: log.topics, strict: true })
    } catch {
      continue
    }
    const args = event.args as Record<string, unknown>
    if (event.eventName === 'Transfer') {
      const from = args.from as Address
      const to = args.to as Address
      const amount = (nft ? args.tokenId : args.value) as bigint
      const token = native ? 'native' : log.address
      if (same(from, account)) movements.push({ direction: 'out', token, amount, nft, counterparty: to })
      else if (same(to, account)) movements.push({ direction: 'in', token, amount, nft, counterparty: from })
    } else if (event.eventName === 'Approval' && same(args.owner as string, account)) {
      const spender = (nft ? args.approved : args.spender) as Address
      const amount = (nft ? 1n : args.value) as bigint
      approvals.push({ token: log.address, spender, amount, revoke: nft ? same(spender, zeroAddress) : amount === 0n })
    } else if (event.eventName === 'ApprovalForAll' && same(args.owner as string, account)) {
      approvals.push({ token: log.address, spender: args.operator as Address, amount: 'all', revoke: !args.approved })
    }
  }
  return { movements, approvals }
}

/** What the transaction data says it will do (used when the RPC can't simulate). */
function fromCalldata(calls: SimCall[], account: Address) {
  const movements: RawMovement[] = []
  const approvals: RawApproval[] = []
  for (const call of calls) {
    if (call.value)
      movements.push({
        direction: 'out',
        token: 'native',
        amount: call.value,
        counterparty: call.to ?? zeroAddress,
        toNewContract: !call.to,
      })
    if (!call.to || !call.data || call.data === '0x') continue
    try {
      const { functionName, args } = decodeFunctionData({ abi: callsAbi, data: call.data })
      if (functionName === 'transfer')
        movements.push({ direction: 'out', token: call.to, amount: args[1], counterparty: args[0] })
      else if (functionName === 'transferFrom' && same(args[0], account))
        movements.push({ direction: 'out', token: call.to, amount: args[2], counterparty: args[1] })
      else if (functionName === 'approve')
        approvals.push({ token: call.to, spender: args[0], amount: args[1], revoke: args[1] === 0n })
      else if (functionName === 'setApprovalForAll')
        approvals.push({ token: call.to, spender: args[0], amount: 'all', revoke: !args[1] })
    } catch {
      // unknown function: nothing we can describe from the data alone
    }
  }
  return { movements, approvals }
}

async function tokenInfo(chainId: number, addresses: Address[]): Promise<Map<string, TokenInfo>> {
  const client = clientFor(chainId)
  const out = new Map<string, TokenInfo>()
  const unknown = addresses.filter((a) => {
    if (same(a, USDC[chainId])) out.set(a.toLowerCase(), { address: a, symbol: 'USDC', decimals: USDC_DECIMALS })
    return !out.has(a.toLowerCase())
  })
  if (unknown.length && client) {
    const results = await client
      .multicall({
        allowFailure: true,
        contracts: unknown.flatMap((address) => [
          { address, abi: erc20Abi, functionName: 'symbol' } as const,
          { address, abi: erc20Abi, functionName: 'decimals' } as const,
        ]),
      })
      .catch(() => [])
    unknown.forEach((address, i) => {
      const symbol = results[i * 2]?.status === 'success' ? String(results[i * 2].result) : undefined
      const decimals = results[i * 2 + 1]?.status === 'success' ? Number(results[i * 2 + 1].result) : 0
      out.set(address.toLowerCase(), { address, symbol: symbol?.slice(0, 16) || 'tokens', decimals })
    })
  }
  return out
}

export async function simulate(
  chainId: number,
  account: Address,
  calls: SimCall[],
  /** Pretend `account` holds this much native coin (used by the no-wallet demo). */
  fundedWith?: bigint,
): Promise<Simulation> {
  const client = clientFor(chainId)
  if (!client) return { status: 'unavailable', reason: 'Unsupported network' }
  const overrides = fundedWith !== undefined ? [{ address: account, balance: fundedWith }] : undefined

  let engine: 'simulate' | 'estimate' = 'simulate'
  let gasUsed = 0n
  let raw: ReturnType<typeof fromLogs>
  try {
    const [block] = await client.simulateBlocks({
      blocks: [
        {
          // viem's call type insists on `to`; the RPC accepts calls without it as deployments.
          calls: calls.map((c) => ({ ...c, account })) as { to: Address; data?: Hex; value?: bigint }[],
          stateOverrides: overrides,
        },
      ],
      traceTransfers: true,
    })
    const failed = block.calls.find((c) => c.status !== 'success')
    if (failed) return { status: 'revert', reason: failed.error ? reasonOf(failed.error) : 'The transaction reverted' }
    gasUsed = block.calls.reduce((sum, c) => sum + c.gasUsed, 0n)
    raw = fromLogs(
      block.calls.flatMap((c) => c.logs ?? []),
      account,
    )
    // Nodes that ignore traceTransfers don't log plain ETH sends; add those from the call itself.
    for (const call of calls) {
      const logged = raw.movements.some(
        (m) => m.token === 'native' && m.direction === 'out' && (!call.to || same(m.counterparty, call.to)),
      )
      if (call.value && !logged)
        raw.movements.push({
          direction: 'out',
          token: 'native',
          amount: call.value,
          counterparty: call.to ?? zeroAddress,
          toNewContract: !call.to,
        })
    }
    if (calls.length === 1 && !calls[0].to)
      for (const m of raw.movements) if (m.token === 'native' && m.direction === 'out') m.toNewContract = true
  } catch (error) {
    if (isRevert(error)) return { status: 'revert', reason: reasonOf(error) }
    // eth_simulateV1 not supported (or failed): dry-run each call instead.
    engine = 'estimate'
    try {
      for (const call of calls) gasUsed += await client.estimateGas({ account, ...call, stateOverride: overrides })
    } catch (estimateError) {
      if (isRevert(estimateError)) return { status: 'revert', reason: reasonOf(estimateError) }
      return { status: 'unavailable', reason: reasonOf(estimateError) }
    }
    raw = fromCalldata(calls, account)
  }

  const tokens = await tokenInfo(chainId, [
    ...new Set([
      ...raw.movements.flatMap((m) => (m.token === 'native' ? [] : [m.token])),
      ...raw.approvals.map((a) => a.token),
    ]),
  ])
  const nativeSymbol = client.chain?.nativeCurrency.symbol ?? 'ETH'
  const info = (t: Address | 'native'): TokenInfo =>
    t === 'native'
      ? { address: 'native', symbol: nativeSymbol, decimals: 18 }
      : (tokens.get(t.toLowerCase()) ?? { address: t, symbol: 'tokens', decimals: 0 })

  return {
    status: 'success',
    engine,
    gasUsed,
    movements: raw.movements.map((m) => ({ ...m, token: info(m.token) })),
    approvals: raw.approvals.map((a) => ({ ...a, token: info(a.token) })),
  }
}

/** What the user asked for; anything else leaving the wallet is flagged. */
export type ExpectedOut = { token: Address | 'native'; amount: bigint; to: Address }

/** Outflows and new permissions the user didn't ask for (only meaningful when `expected` is given). */
export function surprises(sim: Simulation | undefined, expected: ExpectedOut[] | undefined) {
  if (!expected || sim?.status !== 'success') return { movements: [] as Movement[], approvals: [] as ApprovalChange[] }
  const movements = sim.movements.filter(
    (m) =>
      m.direction === 'out' &&
      !expected.some(
        (e) =>
          (e.token === 'native' ? m.token.address === 'native' : same(m.token.address, e.token)) &&
          same(m.counterparty, e.to) &&
          m.amount <= e.amount,
      ),
  )
  return { movements, approvals: sim.approvals.filter((a) => !a.revoke) }
}

const keyOf = (calls: SimCall[]) => calls.map((c) => [c.to ?? 'create', c.data ?? '0x', String(c.value ?? 0n)])

/**
 * Simulates `calls` against the latest block. Never served from cache: each time the
 * review opens it runs again, and it re-runs every 20s while shown.
 */
export function useSimulation(chainId: number | undefined, account: Address | undefined, calls: SimCall[] | undefined) {
  return useQuery({
    queryKey: ['simulate', chainId, account, calls ? keyOf(calls) : null],
    enabled: !!chainId && !!account && !!calls?.length,
    queryFn: () => simulate(chainId!, account!, calls!),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 20_000,
    retry: false,
  })
}
