// Every ERC-20 a wallet holds (from Blockscout), with USD values and a scam-token filter.

export type BsTokenBalance = {
  value?: string | null
  token?: {
    address_hash?: string
    address?: string
    name?: string | null
    symbol?: string | null
    decimals?: string | number | null
    exchange_rate?: string | number | null
    icon_url?: string | null
    type?: string | null
    reputation?: string | null
  } | null
}

export type Holding = {
  address: string
  name: string
  symbol: string
  amount: number
  usd?: number
  icon?: string
  spam?: string
}

// Official contracts for symbols scammers love to copy, per chain.
const OFFICIAL: Record<number, Record<string, string[]>> = {
  1: {
    USDC: ['0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'],
    USDT: ['0xdac17f958d2ee523a2206206994597c13d831ec7'],
    WETH: ['0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'],
    DAI: ['0x6b175474e89094c44da98b954eedeac495271d0f'],
    ETH: [],
  },
  8453: {
    USDC: ['0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'],
    USDBC: ['0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca'],
    USDT: ['0xfde4c96c8593536e31f229ea8f37b2ada2699bb2'],
    WETH: ['0x4200000000000000000000000000000000000006'],
    DAI: ['0x50c5725949a6f0c72e6c4a641f24049a917db0cb'],
    ETH: [],
  },
  42161: {
    USDC: ['0xaf88d065e77c8cc2239327c5edb3a432268e5831'],
    'USDC.E': ['0xff970a61a04b1ca14834a43f5de4533ebddb5cc8'],
    USDT: ['0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9'],
    WETH: ['0x82af49447d8a07e3bd95bd0d56f35241523fbab1'],
    DAI: ['0xda10009cbd5d07dd0cecc66161fc93d7c9000da1'],
    ARB: ['0x912ce59144191c1204e64559fe8253a0e49e6548'],
    ETH: [],
  },
  10: {
    USDC: ['0x0b2c639c533813f4aa9d7837caf62653d097ff85'],
    'USDC.E': ['0x7f5c764cbc14f9669b88837ca1490cca17c31607'],
    USDT: ['0x94b008aa00579c1307b0ef2c499ad98a8ce58e58'],
    WETH: ['0x4200000000000000000000000000000000000006'],
    DAI: ['0xda10009cbd5d07dd0cecc66161fc93d7c9000da1'],
    OP: ['0x4200000000000000000000000000000000000042'],
    ETH: [],
  },
  137: {
    USDC: ['0x3c499c542cef5e3811e1192ce70d8cc03d5c3359'],
    'USDC.E': ['0x2791bca1f2de4661ed88a30c99a7a9449aa84174'],
    USDT: ['0xc2132d05d31c914a87c6611c10748aeb04b58e8f'],
    WETH: ['0x7ceb23fd6bc0add59e62ac25578270cff1b9f619'],
    DAI: ['0x8f3cf7ad23cd3cadbd9735aff958023239c6a063'],
    WPOL: ['0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270'],
    WMATIC: ['0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270'],
    POL: ['0x0000000000000000000000000000000000001010'],
    MATIC: ['0x0000000000000000000000000000000000001010'],
  },
  11155111: {
    USDC: ['0x1c7d4b196cb0c7b01d743fbc6116a902379c7238'],
    WETH: ['0xfff9976782d46cc05630d1f6ebab18b2324d6b14'],
    ETH: [],
  },
}

const LINKY = /(https?:|www\.|t\.me|\.(com|io|xyz|org|net|app|finance|site|online|top|vip|cc|gift|claims?|lol)\b)/i
const BAIT = /\b(claim|visit|reward|airdrop|voucher|bonus|gift|redeem|free|access token)\b/i

// Cyrillic / Greek letters that look identical to Latin ones in most fonts.
const CONFUSABLES: Record<string, string> = {
  А: 'A',
  В: 'B',
  С: 'C',
  Е: 'E',
  Н: 'H',
  І: 'I',
  К: 'K',
  М: 'M',
  О: 'O',
  Р: 'P',
  Т: 'T',
  Х: 'X',
  У: 'Y',
  Ѕ: 'S',
  а: 'a',
  с: 'c',
  е: 'e',
  о: 'o',
  р: 'p',
  х: 'x',
  у: 'y',
  ѕ: 's',
  і: 'i',
  Α: 'A',
  Β: 'B',
  Ε: 'E',
  Ζ: 'Z',
  Η: 'H',
  Ι: 'I',
  Κ: 'K',
  Μ: 'M',
  Ν: 'N',
  Ο: 'O',
  Ρ: 'P',
  Τ: 'T',
  Υ: 'Y',
  Χ: 'X',
  ο: 'o',
  '₮': 'T',
  '＄': '$',
}
const deconfuse = (text: string) => [...text.normalize('NFKC')].map((ch) => CONFUSABLES[ch] ?? ch).join('')

/** Spam check for free-text names (NFT collections, token names). */
export function spamText(...texts: (string | null | undefined)[]) {
  for (const t of texts) {
    if (!t) continue
    if (LINKY.test(t)) return 'Name contains a website — classic airdrop scam'
    if (BAIT.test(t)) return 'Bait wording (claim / reward / airdrop)'
  }
  return undefined
}

/** Returns a reason if the token looks like spam, else undefined. */
export function spamReason(chainId: number, address: string, name: string, symbol: string, reputation?: string | null) {
  if (reputation && reputation.toLowerCase() === 'scam') return 'Flagged as scam by the explorer'
  if (LINKY.test(name) || LINKY.test(symbol)) return 'Name contains a website — classic airdrop scam'
  if (BAIT.test(name) || BAIT.test(symbol)) return 'Bait wording (claim / reward / airdrop)'
  const latin = deconfuse(symbol)
  const official = OFFICIAL[chainId] ?? {}
  if (latin !== symbol && official[latin.toUpperCase()])
    return `Look-alike letters pretending to be ${latin.toUpperCase()}`
  const allowed = official[symbol.toUpperCase()]
  if (allowed && !allowed.includes(address.toLowerCase()))
    return `Fake ${symbol.toUpperCase()} — not the official contract`
  return undefined
}

export function toHoldings(chainId: number, rows: BsTokenBalance[]): Holding[] {
  return rows
    .filter((r) => r.token && (r.token.type ?? 'ERC-20') === 'ERC-20')
    .map((r) => {
      const t = r.token!
      const address = (t.address_hash ?? t.address ?? '').toString()
      const decimals = Number(t.decimals ?? 18)
      const raw = Number(r.value ?? 0)
      const amount = Number.isFinite(raw) ? raw / 10 ** (Number.isFinite(decimals) ? decimals : 18) : 0
      const rate = t.exchange_rate != null ? Number(t.exchange_rate) : undefined
      const name = (t.name ?? '').trim() || 'Unknown token'
      const symbol = (t.symbol ?? '').trim() || '???'
      const spam = spamReason(chainId, address, name, symbol, t.reputation)
      return {
        address,
        name,
        symbol,
        amount,
        usd: rate !== undefined && Number.isFinite(rate) && !spam ? amount * rate : undefined,
        icon: t.icon_url ?? undefined,
        spam,
      }
    })
    .filter((h) => h.amount > 0 && h.address)
    .sort((a, b) => (b.usd ?? -1) - (a.usd ?? -1) || b.amount - a.amount)
}
