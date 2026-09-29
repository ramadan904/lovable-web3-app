import { useQuery } from '@tanstack/react-query'
import { erc20Abi, getAddress, maxUint256, pad, parseAbi, type Address, type ContractFunctionParameters } from 'viem'
import { readContracts } from 'wagmi/actions'

import { BLOCKSCOUT } from '@/lib/blockscout'
import { config, type ChainId } from '@/lib/wagmi'
import { fetchWithRetry, HttpError } from '@/lib/net'

// keccak256("Approval(address,address,uint256)") and keccak256("ApprovalForAll(address,address,bool)")
const APPROVAL = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'
const APPROVAL_FOR_ALL = '0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31'

export const nftAbi = parseAbi([
  'function isApprovedForAll(address owner, address operator) view returns (bool)',
  'function setApprovalForAll(address operator, bool approved)',
  'function name() view returns (string)',
])

// Well-known spenders, so people recognise what they approved.
const KNOWN: Record<string, string> = {
  '0x000000000022d473030f116ddee9f6b43ac78ba3': 'Uniswap Permit2',
  '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad': 'Uniswap Universal Router',
  '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': 'Uniswap Swap Router 02',
  '0x2626664c2603336e57b271c5c0b26f421741e481': 'Uniswap Swap Router 02',
  '0x1e0049783f008a0085193e00003d00cd54003c71': 'OpenSea Conduit',
  '0x1111111254eeb25477b68fb85ed929f73a960582': '1inch Router v5',
  '0x111111125421ca6dc452d289314280a0f8842a65': '1inch Router v6',
  '0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43': 'Aerodrome Router',
  '0x6131b5fae19ea4f9d964eac0408e4408b66337b5': 'KyberSwap Router',
}

export type Approval = {
  kind: 'token' | 'nft'
  token: Address
  tokenLabel: string
  spender: Address
  spenderLabel?: string
  spenderIsContract?: boolean
  spenderVerified?: boolean
  /** ERC-20 allowance in token units; undefined for NFT operators. */
  allowance?: bigint
  decimals?: number
  unlimited: boolean
  lastSeen?: Date
  risks: { level: 'danger' | 'warning' | 'info'; text: string }[]
}

type Log = { address: string; topics: (string | null)[]; timeStamp?: string }
type LogsResponse = { status?: string; message?: string; result?: Log[] | string }

async function getLogs(base: string, topic0: string, owner: Address): Promise<Log[]> {
  const params = new URLSearchParams({
    module: 'logs',
    action: 'getLogs',
    fromBlock: '0',
    toBlock: 'latest',
    topic0,
    topic1: pad(owner.toLowerCase() as Address),
    topic0_1_opr: 'and',
  })
  const res = await fetchWithRetry(`${base}/api?${params}`)
  if (!res.ok) throw new HttpError(res, 'Explorer logs request')
  const body = (await res.json()) as LogsResponse
  if (Array.isArray(body.result)) return body.result
  if (body.message?.toLowerCase().includes('no logs')) return []
  throw new Error(typeof body.result === 'string' ? body.result : 'Explorer logs unavailable')
}

const topicAddress = (t: string | null | undefined) => (t ? getAddress(`0x${t.slice(-40)}`) : undefined)

type Candidate = { kind: 'token' | 'nft'; token: Address; spender: Address; lastSeen?: Date }

async function candidatesFromLogs(base: string, owner: Address) {
  const [tokenLogs, nftLogs] = await Promise.all([
    getLogs(base, APPROVAL, owner),
    getLogs(base, APPROVAL_FOR_ALL, owner),
  ])
  const byKey = new Map<string, Candidate>()
  const add = (kind: Candidate['kind'], log: Log) => {
    const spender = topicAddress(log.topics[2])
    if (!spender) return
    const token = getAddress(log.address)
    const ts = log.timeStamp ? Number(log.timeStamp) : NaN
    const lastSeen = Number.isFinite(ts) ? new Date(ts * 1000) : undefined
    const key = `${kind}:${token}:${spender}`.toLowerCase()
    const prev = byKey.get(key)
    if (!prev || (lastSeen && (!prev.lastSeen || lastSeen > prev.lastSeen)))
      byKey.set(key, { kind, token, spender, lastSeen })
  }
  // ERC-20 Approval has 3 topics; ERC-721 single-token Approval has 4 (and clears on transfer), so skip those.
  tokenLogs.filter((l) => l.topics.filter(Boolean).length === 3).forEach((l) => add('token', l))
  nftLogs.forEach((l) => add('nft', l))
  return [...byKey.values()]
}

/** Fallback when log search is unavailable: tokens you hold × contracts you've called. */
async function candidatesFromHoldings(base: string, owner: Address): Promise<Candidate[]> {
  const [tokens, txs] = await Promise.all([
    fetchWithRetry(`${base}/api/v2/addresses/${owner}/token-balances`).then((r) => (r.ok ? r.json() : [])),
    fetchWithRetry(`${base}/api/v2/addresses/${owner}/transactions`).then((r) => (r.ok ? r.json() : { items: [] })),
  ])
  const tokenAddrs = (tokens as { token?: { address_hash?: string; address?: string; type?: string } }[])
    .filter((t) => t.token?.type === 'ERC-20')
    .map((t) => t.token?.address_hash ?? t.token?.address)
    .filter((a): a is string => !!a)
    .slice(0, 15)
  const spenders = [
    ...new Set(
      ((txs as { items?: { to?: { hash?: string; is_contract?: boolean } }[] }).items ?? [])
        .filter((t) => t.to?.is_contract && t.to.hash)
        .map((t) => t.to!.hash!.toLowerCase()),
    ),
  ].slice(0, 10)
  return tokenAddrs.flatMap((token) =>
    spenders.map((spender) => ({ kind: 'token' as const, token: getAddress(token), spender: getAddress(spender) })),
  )
}

type SpenderInfo = { name?: string | null; is_contract?: boolean; is_verified?: boolean }

async function spenderInfo(base: string, spender: Address): Promise<SpenderInfo> {
  try {
    const res = await fetchWithRetry(`${base}/api/v2/addresses/${spender}`)
    return res.ok ? ((await res.json()) as SpenderInfo) : {}
  } catch {
    return {}
  }
}

export async function scanApprovals(owner: Address, chainId: ChainId) {
  const base = BLOCKSCOUT[chainId]
  let candidates: Candidate[]
  let method: 'logs' | 'holdings' = 'logs'
  try {
    candidates = await candidatesFromLogs(base, owner)
  } catch {
    method = 'holdings'
    candidates = await candidatesFromHoldings(base, owner)
  }
  candidates = candidates.slice(0, 150)
  if (candidates.length === 0) return { approvals: [] as Approval[], method }

  // Current on-chain state for every candidate, plus token metadata, in one multicall.
  // Three reads per candidate: current approval, a display label, and decimals.
  const calls = candidates.flatMap((c): ContractFunctionParameters[] =>
    c.kind === 'token'
      ? [
          { address: c.token, abi: erc20Abi, functionName: 'allowance', args: [owner, c.spender] },
          { address: c.token, abi: erc20Abi, functionName: 'symbol' },
          { address: c.token, abi: erc20Abi, functionName: 'decimals' },
        ]
      : [
          { address: c.token, abi: nftAbi, functionName: 'isApprovedForAll', args: [owner, c.spender] },
          { address: c.token, abi: nftAbi, functionName: 'name' },
          { address: c.token, abi: erc20Abi, functionName: 'decimals' },
        ],
  )
  const state = await readContracts(config, {
    allowFailure: true,
    contracts: calls.map((call) => ({ ...call, chainId })),
  })

  const active = candidates
    .map((c, i) => {
      const [value, label, decimals] = state.slice(i * 3, i * 3 + 3)
      if (value?.status !== 'success') return undefined
      const tokenLabel =
        label?.status === 'success' ? String(label.result) : `${c.token.slice(0, 6)}…${c.token.slice(-4)}`
      if (c.kind === 'nft') return value.result === true ? { c, tokenLabel } : undefined
      const allowance = value.result as bigint
      return allowance > 0n
        ? { c, tokenLabel, allowance, decimals: decimals?.status === 'success' ? Number(decimals.result) : 18 }
        : undefined
    })
    .filter((x) => !!x)

  const infos = await Promise.all(active.slice(0, 40).map((a) => spenderInfo(base, a.c.spender)))
  const yearAgo = Date.now() - 365 * 86_400_000

  const approvals: Approval[] = active.map((a, i) => {
    const info = infos[i] ?? {}
    const known = KNOWN[a.c.spender.toLowerCase()]
    const unlimited = a.c.kind === 'nft' || (a.allowance !== undefined && a.allowance >= maxUint256 / 2n)
    const risks: Approval['risks'] = []
    if (info.is_contract === false)
      risks.push({ level: 'danger', text: 'Spender is a regular wallet, not a contract — a common drainer pattern.' })
    else if (info.is_contract && info.is_verified === false && !known)
      risks.push({ level: 'warning', text: 'Spender contract is not verified on the explorer.' })
    if (a.c.kind === 'nft') risks.push({ level: 'warning', text: 'Can move every NFT you hold in this collection.' })
    else if (unlimited)
      risks.push({ level: 'warning', text: 'Unlimited amount — it can take all of this token, now or later.' })
    if (a.c.lastSeen && a.c.lastSeen.getTime() < yearAgo)
      risks.push({ level: 'info', text: 'Granted over a year ago. Still using it?' })
    return {
      kind: a.c.kind,
      token: a.c.token,
      tokenLabel: a.tokenLabel,
      spender: a.c.spender,
      spenderLabel: known ?? info.name ?? undefined,
      spenderIsContract: info.is_contract,
      spenderVerified: info.is_verified,
      allowance: a.allowance,
      decimals: a.decimals,
      unlimited,
      lastSeen: a.c.lastSeen,
      risks,
    }
  })

  const rank = (x: Approval) =>
    x.risks.some((r) => r.level === 'danger') ? 0 : x.risks.some((r) => r.level === 'warning') ? 1 : 2
  approvals.sort((a, b) => rank(a) - rank(b))
  return { approvals, method }
}

export function useApprovals(owner: Address | undefined, chainId: ChainId) {
  return useQuery({
    queryKey: ['approvals', chainId, owner?.toLowerCase()],
    enabled: !!owner && !!BLOCKSCOUT[chainId],
    staleTime: 60_000,
    retry: 1,
    queryFn: () => scanApprovals(owner!, chainId),
  })
}
