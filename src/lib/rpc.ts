import { fallback, http, type Transport } from 'viem'

/**
 * RPC endpoints, in priority order:
 *   1. VITE_RPC_<CHAIN>  — any provider URL (Infura, QuickNode, Alchemy, your own node…)
 *   2. VITE_ALCHEMY_KEY  — one key, URLs built for every supported chain
 *   3. the chain's public RPC — always kept last as a fallback
 *
 * Vite inlines VITE_* values into the browser bundle, so they are public:
 * restrict provider keys to your domains in the provider's dashboard.
 */
const ALCHEMY_SUBDOMAIN: Record<number, string> = {
  1: 'eth-mainnet',
  8453: 'base-mainnet',
  11155111: 'eth-sepolia',
  42161: 'arb-mainnet',
  10: 'opt-mainnet',
  137: 'polygon-mainnet',
}

const ENV_NAME: Record<number, string> = {
  1: 'VITE_RPC_ETHEREUM',
  8453: 'VITE_RPC_BASE',
  11155111: 'VITE_RPC_SEPOLIA',
  42161: 'VITE_RPC_ARBITRUM',
  10: 'VITE_RPC_OPTIMISM',
  137: 'VITE_RPC_POLYGON',
}

const env = import.meta.env as Record<string, string | undefined>
const clean = (v?: string) => (v && v.trim() ? v.trim() : undefined)

/** Private RPC URLs configured for a chain (possibly none). */
export function privateRpcUrls(chainId: number): string[] {
  const urls: string[] = []
  const explicit = clean(env[ENV_NAME[chainId] ?? ''])
  if (explicit) urls.push(explicit)
  const alchemy = clean(env.VITE_ALCHEMY_KEY)
  if (alchemy && ALCHEMY_SUBDOMAIN[chainId])
    urls.push(`https://${ALCHEMY_SUBDOMAIN[chainId]}.g.alchemy.com/v2/${alchemy}`)
  return urls
}

/** Configured RPCs first, the chain's public RPC last; viem moves on if one fails. */
export function transportFor(chainId: number): Transport {
  const privates = privateRpcUrls(chainId).map((url) => http(url, { batch: true, retryCount: 1 }))
  const publicRpc = http(undefined, { retryCount: 2 })
  return privates.length ? fallback([...privates, publicRpc]) : publicRpc
}

/** True when at least one chain uses a configured (non-public) RPC. */
export const usingPrivateRpc = Object.keys(ENV_NAME).some((id) => privateRpcUrls(Number(id)).length > 0)
