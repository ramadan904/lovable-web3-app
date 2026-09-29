import { createConfig } from 'wagmi'
import { base, mainnet, sepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

import { transportFor } from '@/lib/rpc'

export const config = createConfig({
  chains: [mainnet, base, sepolia],
  connectors: [injected()],
  transports: {
    [mainnet.id]: transportFor(mainnet.id),
    [base.id]: transportFor(base.id),
    [sepolia.id]: transportFor(sepolia.id),
  },
})

export type ChainId = (typeof config)['chains'][number]['id']

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
