// Plain-English commands, parsed locally (no AI service, nothing leaves the browser).

export type Command =
  | { kind: 'send'; amount: string; token: 'ETH' | 'USDC'; to: string; chain?: string }
  | { kind: 'switch'; chain: string }
  | { kind: 'theme'; theme: 'light' | 'dark' }
  | { kind: 'currency'; currency: 'USD' | 'NGN' | 'EUR' | 'GBP' }
  | { kind: 'copy' }
  | { kind: 'receive' }
  | {
      kind: 'goto'
      view: 'dashboard' | 'gas' | 'wrapped' | 'approvals' | 'watch' | 'prove' | 'tx' | 'view' | 'lock'
      target?: string
    }

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
// An address, an ENS name, or a saved contact nickname (resolved by the Send form).
const RECIPIENT = String.raw`(0x[a-fA-F0-9]{40}|@?[\w-]+(?:\.[\w-]+)*)`
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

  m = text.match(/^(?:show (?:in|me)|use|currency|in|switch to)?\s*(usd|dollars?|ngn|naira|eur|euros?|gbp|pounds?)$/i)
  if (m) {
    const w = m[1].toLowerCase()
    const currency = w.startsWith('n')
      ? 'NGN'
      : w.startsWith('e')
        ? 'EUR'
        : w.startsWith('g') || w.startsWith('p')
          ? 'GBP'
          : 'USD'
    return { kind: 'currency', currency }
  }

  if (/^(?:copy(?:\s+my)?\s+address|copy)$/i.test(text)) return { kind: 'copy' }
  if (/^(?:receive|my address|show (?:my )?address|qr(?: code)?|deposit)$/i.test(text)) return { kind: 'receive' }
  if (/^(?:gas|fees?|gas (?:price|tracker)|cheapest (?:chain|network))$/i.test(text))
    return { kind: 'goto', view: 'gas' }
  if (/^(?:home|dashboard|portfolio|balances?)$/i.test(text)) return { kind: 'goto', view: 'dashboard' }
  if (/^(?:revoke|approvals?|allowances?|guard|approval guard|check approvals)$/i.test(text))
    return { kind: 'goto', view: 'approvals' }

  m = text.match(/^(?:explain|decode|what(?:'s| is| happened in)?)?\s*(0x[0-9a-fA-F]{64})\??$/i)
  if (m) return { kind: 'goto', view: 'tx', target: m[1] }
  if (/^(?:explain|decode|explain (?:a )?tx|explainer)$/i.test(text)) return { kind: 'goto', view: 'tx' }

  if (/^(?:prove(?: it'?s me| ownership| it)?|proof|sign(?: a)? proof|verify me)$/i.test(text))
    return { kind: 'goto', view: 'prove' }
  if (/^(?:lock|savings?(?: lock)?|piggy ?bank|save|vault|hodl)$/i.test(text)) return { kind: 'goto', view: 'lock' }
  if (/^(?:watch|whales?|whale watch|watchlist|alerts?)$/i.test(text)) return { kind: 'goto', view: 'watch' }

  m = text.match(/^(?:view|look up|lookup|check|open|show)\s+(0x[a-fA-F0-9]{40}|@?[\w-]+(?:\.[\w-]+)*)$/i)
  if (m && !/^(?:address|my|qr|gas|approvals?)$/i.test(m[1])) return { kind: 'goto', view: 'view', target: m[1] }

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
  'view vitalik.eth',
  'gas',
  'revoke',
  'watch',
  'piggy bank',
  'prove',
  'explain',
  'dark mode',
  'show in naira',
  'copy address',
]
