import { erc20Abi, formatUnits, parseAbi, type Address } from 'viem'
import { useChains, useReadContracts } from 'wagmi'

import { USDC, USDC_DECIMALS } from '@/lib/tokens'

// Multicall3 is deployed at the same address on every supported chain and
// exposes getEthBalance, so native and token balances come back in one batch.
const MULTICALL3: Address = '0xcA11bde05977b3631167028862bE2a173976CA11'
const multicallAbi = parseAbi(['function getEthBalance(address) view returns (uint256)'])

export type ChainBalances = {
  chainId: number
  eth?: bigint
  usdc?: bigint
  /** The chain's RPC failed on the last refresh; values (if any) are the last ones that loaded. */
  failed: boolean
}

// Last balances that loaded per address + chain, so one flaky RPC response
// doesn't blank a row that was fine a moment ago.
const lastGood = new Map<string, { eth?: bigint; usdc?: bigint }>()

/** ETH and USDC balances for `address` on every configured chain. */
export function useBalances(address: Address | undefined) {
  const chains = useChains()
  const query = useReadContracts({
    contracts: chains.flatMap((chain) => [
      {
        address: MULTICALL3,
        abi: multicallAbi,
        functionName: 'getEthBalance',
        args: [address!],
        chainId: chain.id,
      } as const,
      {
        address: USDC[chain.id],
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address!],
        chainId: chain.id,
      } as const,
    ]),
    query: { enabled: !!address, refetchInterval: 30_000 },
  })

  const balances: ChainBalances[] = chains.map((chain, i) => {
    const eth = query.data?.[i * 2]
    const usdc = query.data?.[i * 2 + 1]
    const key = `${address?.toLowerCase()}:${chain.id}`
    const prev = lastGood.get(key)
    const next = {
      eth: eth?.status === 'success' ? (eth.result as bigint) : prev?.eth,
      usdc: usdc?.status === 'success' ? (usdc.result as bigint) : prev?.usdc,
    }
    if (eth?.status === 'success' || usdc?.status === 'success') lastGood.set(key, next)
    // The USDC call legitimately fails where the token isn't deployed, so only ETH decides reachability.
    const failed = query.isError || eth?.status === 'failure'
    return { chainId: chain.id, ...next, failed }
  })

  return { ...query, balances }
}

export const toEth = (wei: bigint) => Number(formatUnits(wei, 18))
export const toUsdc = (units: bigint) => Number(formatUnits(units, USDC_DECIMALS))
