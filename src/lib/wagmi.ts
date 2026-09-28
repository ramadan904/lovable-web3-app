import { http, createConfig } from 'wagmi'
import { base, mainnet, sepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

export const config = createConfig({
  chains: [mainnet, base, sepolia],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [sepolia.id]: http(),
  },
})

export type ChainId = (typeof config)['chains'][number]['id']

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
