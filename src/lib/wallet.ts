import { useConnectors } from 'wagmi'

/**
 * Connect options, in order: browser wallets, then remote ones (WalletConnect).
 * Wallets announced via EIP-6963 show up by name; the generic injected connector
 * is kept only when none are detected and a provider exists (or nothing else does).
 */
export function useWalletOptions() {
  const connectors = useConnectors()
  const browser = connectors.filter((c) => c.type === 'injected')
  const remote = connectors.filter((c) => c.type !== 'injected')
  const detected = browser.filter((c) => c.id !== 'injected')
  const hasProvider = typeof window !== 'undefined' && 'ethereum' in window
  const local = detected.length > 0 ? detected : hasProvider || remote.length === 0 ? browser : []
  return [...local, ...remote]
}

export function connectorLabel(connector: { id: string; name: string; type: string }) {
  if (connector.type === 'walletConnect') return 'WalletConnect (phone / QR)'
  return connector.id === 'injected' ? 'Connect browser wallet' : `Connect ${connector.name}`
}
