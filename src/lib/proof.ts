import { isAddress, isHex, type Address, type Hex } from 'viem'

export type Proof = { address: Address; message: string; signature: Hex }

const toBase64Url = (text: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

function fromBase64Url(value: string) {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function buildProofMessage(address: Address, purpose: string, now = new Date()) {
  const nonce = Math.random().toString(36).slice(2, 10)
  return [
    'I control this wallet.',
    `Wallet: ${address}`,
    `For: ${purpose.trim() || 'anyone who asks'}`,
    `Signed at: ${now.toISOString()}`,
    `Nonce: ${nonce}`,
  ].join('\n')
}

export function buildProofLink(proof: Proof) {
  const params = new URLSearchParams({ a: proof.address, m: toBase64Url(proof.message), s: proof.signature })
  return `${window.location.origin}${window.location.pathname}#/verify?${params}`
}

export function readProof(params: URLSearchParams | undefined): Proof | null {
  if (!params) return null
  const address = params.get('a') ?? ''
  const signature = params.get('s') ?? ''
  const encoded = params.get('m') ?? ''
  if (!isAddress(address) || !isHex(signature) || !encoded) return null
  try {
    const message = fromBase64Url(encoded)
    return message.length > 0 && message.length <= 2000 ? { address, message, signature } : null
  } catch {
    return null
  }
}

/** The "Signed at" line, if present, so verifiers can judge freshness. */
export function signedAt(message: string) {
  const m = message.match(/^Signed at: (.+)$/m)
  const d = m ? new Date(m[1]) : undefined
  return d && !Number.isNaN(d.getTime()) ? d : undefined
}
