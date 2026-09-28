// Plain-English commands, parsed locally (no AI service, nothing leaves the browser).

export type Command =
  | { kind: 'send'; amount: string; token: 'ETH' | 'USDC'; to: string; chain?: string }
  | { kind: 'switch'; chain: string }
  | { kind: 'theme'; theme: 'light' | 'dark' }
  | { kind: 'copy' }
  | { kind: 'receive' }
  | { kind: 'goto'; view: 'dashboard' | 'gas' | 'wrapped' | 'approvals' | 'watch' | 'prove'; target?: string }

export const CHAIN_ALIASES: Record<string, string> = {
  ethereum: 'ethereum',
  eth: 'ethereum',
  mainnet: 'ethereum',
  base: 'base',
  sepolia: 'sepolia',
  testnet: 'sepolia',
}

const AMOUNT = String.raw`(\d+(?:\.\d+)?|\.\d+)`
const TOKEN = String.raw`(eth|ether|usdc|\$)`
const RECIPIENT = String.raw`(0x[a-fA-F0-9]{40}|[\w-]+(?:\.[\w-]+)+)`
const CHAIN = String.raw`(?:\s+(?:on|via)\s+(\w+))?`

const SEND_PATTERNS = [
  // send 5 usdc to vitalik.eth on base
  new RegExp(String.raw`^(?:send|pay|transfer)\s+${AMOUNT}\s*${TOKEN}\s+to\s+${RECIPIENT}${CHAIN}$`, 'i'),
  // pay vitalik.eth 5 usdc on base
  new RegExp(String.raw`^(?:send|pay|transfer)\s+${RECIPIENT}\s+${AMOUNT}\s*${TOKEN}${CHAIN}$`, 'i'),
  // $5 to vitalik.eth
  new RegExp(String.raw`^(?:send|pay|transfer)?\s*\$${AMOUNT}\s+to\s+${RECIPIENT}${CHAIN}$`, 'i'),
]

function tokenOf(raw: string): 'ETH' | 'USDC' {
  const t = raw.toLowerCase()
  return t === 'usdc' || t === '$' ? 'USDC' : 'ETH'
}

function chainOf(raw?: string) {
  return raw ? CHAIN_ALIASES[raw.toLowerCase()] : undefined
}

export function parseCommand(input: string): Command | null {
  const text = input.trim().replace(/\s+/g, ' ')
  if (!text) return null

  let m = text.match(SEND_PATTERNS[0])
  if (m) return withChain({ kind: 'send', amount: m[1], token: tokenOf(m[2]), to: m[3] }, m[4])
  m = text.match(SEND_PATTERNS[1])
  if (m) return withChain({ kind: 'send', amount: m[2], token: tokenOf(m[3]), to: m[1] }, m[4])
  m = text.match(SEND_PATTERNS[2])
  if (m) return withChain({ kind: 'send', amount: m[1], token: 'USDC', to: m[2] }, m[3])

  m = text.match(/^(?:switch|go|change|move)(?:\s+(?:to|network\s+to))?\s+(\w+)$/i)
  if (m && chainOf(m[1])) return { kind: 'switch', chain: chainOf(m[1])! }

  m = text.match(/^(?:(dark|light)(?:\s+mode)?|(?:switch\s+to|use)\s+(dark|light)(?:\s+mode)?)$/i)
  if (m) return { kind: 'theme', theme: (m[1] ?? m[2]).toLowerCase() as 'light' | 'dark' }

  if (/^(?:copy(?:\s+my)?\s+address|copy)$/i.test(text)) return { kind: 'copy' }
  if (/^(?:receive|my address|show (?:my )?address|qr(?: code)?|deposit)$/i.test(text))
    return { kind: 'receive' }
  if (/^(?:gas|fees?|gas (?:price|tracker)|cheapest (?:chain|network))$/i.test(text))
    return { kind: 'goto', view: 'gas' }
  if (/^(?:home|dashboard|portfolio|balances?)$/i.test(text)) return { kind: 'goto', view: 'dashboard' }
  if (/^(?:revoke|approvals?|allowances?|guard|approval guard|check approvals)$/i.test(text))
    return { kind: 'goto', view: 'approvals' }

  if (/^(?:prove(?: it'?s me| ownership| it)?|proof|sign(?: a)? proof|verify me)$/i.test(text))
    return { kind: 'goto', view: 'prove' }
  if (/^(?:watch|whales?|whale watch|watchlist|alerts?)$/i.test(text)) return { kind: 'goto', view: 'watch' }

  m = text.match(/^wrap(?:ped)?(?:\s+(?:for\s+)?(\S+))?$/i)
  if (m) return { kind: 'goto', view: 'wrapped', target: m[1] }

  return null
}

function withChain(cmd: Extract<Command, { kind: 'send' }>, raw?: string): Command | null {
  if (raw === undefined) return cmd
  const chain = chainOf(raw)
  return chain ? { ...cmd, chain } : null
}

export const EXAMPLES = [
  'send 0.01 eth to vitalik.eth on sepolia',
  'pay 0x000000000000000000000000000000000000dEaD 5 usdc on base',
  'switch to base',
  'wrapped vitalik.eth',
  'gas',
  'revoke',
  'watch',
  'prove',
  'dark mode',
  'copy address',
]
