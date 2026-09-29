// Short, familiar names for buttons ("Arbitrum One" / "OP Mainnet" are the official ones).
const SHORT: Record<number, string> = { 42161: 'Arbitrum', 10: 'Optimism' }

export const chainLabel = (chain: { id: number; name: string }) => SHORT[chain.id] ?? chain.name
