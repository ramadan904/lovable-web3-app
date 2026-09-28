import { useConnectors } from 'wagmi'

// Wallets announced via EIP-6963 show up by name; keep the generic
// injected connector only as a fallback when none are detected.
export function useWalletOptions() {
  const connectors = useConnectors()
  const detected = connectors.filter((c) => c.id !== 'injected')
  return detected.length > 0 ? detected : connectors
}

export function connectorLabel(connector: { id: string; name: string }) {
  return connector.id === 'injected' ? 'Connect browser wallet' : `Connect ${connector.name}`
}
