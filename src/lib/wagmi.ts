import { createConfig, type CreateConnectorFn } from 'wagmi'
import { arbitrum, base, mainnet, optimism, polygon, sepolia } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

import { transportFor } from '@/lib/rpc'

const wcProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim()

/** Browser wallets always; WalletConnect (QR / mobile wallets) only when a project ID is configured. */
const connectors: CreateConnectorFn[] = [injected()]
if (wcProjectId) {
  const origin = window.location.origin
  connectors.push(
    walletConnect({
      projectId: wcProjectId,
      showQrModal: true,
      metadata: {
        name: 'Wallet Bodyguard',
        description: 'A security-first self-custody wallet dashboard.',
        url: origin,
        icons: [`${origin}${import.meta.env.BASE_URL}icon-192.png`],
      },
    }),
  )
}

export const config = createConfig({
  chains: [mainnet, base, arbitrum, optimism, polygon, sepolia],
  connectors,
  transports: {
    [mainnet.id]: transportFor(mainnet.id),
    [base.id]: transportFor(base.id),
    [arbitrum.id]: transportFor(arbitrum.id),
    [optimism.id]: transportFor(optimism.id),
    [polygon.id]: transportFor(polygon.id),
    [sepolia.id]: transportFor(sepolia.id),
  },
})

export type ChainId = (typeof config)['chains'][number]['id']

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
