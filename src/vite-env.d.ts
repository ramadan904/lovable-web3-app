/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** One Alchemy key used for every supported chain. */
  readonly VITE_ALCHEMY_KEY?: string
  /** Per-chain RPC URLs (take priority over VITE_ALCHEMY_KEY). */
  readonly VITE_RPC_ETHEREUM?: string
  readonly VITE_RPC_BASE?: string
  readonly VITE_RPC_SEPOLIA?: string
  readonly VITE_RPC_ARBITRUM?: string
  readonly VITE_RPC_OPTIMISM?: string
  readonly VITE_RPC_POLYGON?: string
  /** Reown (WalletConnect) project ID; WalletConnect is hidden when unset. */
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
