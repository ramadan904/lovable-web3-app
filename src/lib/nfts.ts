import { spamText } from '@/lib/holdings'

export type BsNft = {
  id?: string | null
  image_url?: string | null
  animation_url?: string | null
  metadata?: { name?: string | null; image?: string | null; image_url?: string | null } | null
  token?: {
    address_hash?: string
    address?: string
    name?: string | null
    symbol?: string | null
    type?: string | null
    reputation?: string | null
  } | null
  token_type?: string | null
  value?: string | null
}

export type Nft = {
  key: string
  contract: string
  tokenId: string
  name: string
  collection: string
  image?: string
  count?: number
  spam?: string
}

/** ipfs:// and ar:// links → public HTTPS gateways; anything else non-http(s) is dropped. */
export function resolveMediaUrl(url?: string | null) {
  if (!url) return undefined
  const u = url.trim()
  if (u.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${u.slice(7).replace(/^ipfs\//, '')}`
  if (u.startsWith('ar://')) return `https://arweave.net/${u.slice(5)}`
  if (/^https?:\/\//i.test(u) || u.startsWith('data:image/')) return u
  return undefined
}

export function toNfts(items: BsNft[]): Nft[] {
  return items
    .map((it) => {
      const contract = (it.token?.address_hash ?? it.token?.address ?? '').toString()
      const tokenId = String(it.id ?? '')
      const collection = it.token?.name?.trim() || it.token?.symbol?.trim() || 'Unknown collection'
      const name = it.metadata?.name?.trim() || `${collection} #${tokenId.length > 10 ? `${tokenId.slice(0, 8)}…` : tokenId}`
      const spam =
        it.token?.reputation?.toLowerCase() === 'scam' ? 'Flagged as scam by the explorer' : spamText(collection, name)
      const count = it.token_type === 'ERC-1155' ? Number(it.value ?? 1) : undefined
      return {
        key: `${contract}:${tokenId}`,
        contract,
        tokenId,
        name,
        collection,
        image: resolveMediaUrl(it.image_url ?? it.metadata?.image ?? it.metadata?.image_url),
        count: count && count > 1 ? count : undefined,
        spam,
      }
    })
    .filter((n) => n.contract)
}
