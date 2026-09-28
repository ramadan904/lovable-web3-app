import type { Address } from 'viem'
import { base, mainnet, sepolia } from 'wagmi/chains'

// Circle's official USDC contracts (6 decimals) on each supported chain.
export const USDC: Record<number, Address> = {
  [mainnet.id]: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  [base.id]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  [sepolia.id]: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
}

export const USDC_DECIMALS = 6
