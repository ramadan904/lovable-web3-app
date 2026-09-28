// Turn untrusted profile text (ENS records) into safe outbound links.

/** Handles like "@alice", "alice" or a full profile URL → a safe https link. */
export function socialUrl(kind: 'x' | 'github', raw?: string | null) {
  if (!raw) return undefined
  const v = raw.trim()
  const host =
    kind === 'x'
      ? /^(?:https?:\/\/)?(?:www\.)?(?:x|twitter)\.com\/@?([\w]{1,15})\/?$/i
      : /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w-]{1,39})\/?$/i
  const plain = kind === 'x' ? /^@?([\w]{1,15})$/ : /^@?([\w-]{1,39})$/
  const handle = v.match(host)?.[1] ?? v.match(plain)?.[1]
  if (!handle) return undefined
  return { href: kind === 'x' ? `https://x.com/${handle}` : `https://github.com/${handle}`, label: `@${handle}` }
}

export function websiteUrl(raw?: string | null) {
  if (!raw) return undefined
  const v = raw.trim()
  const withScheme = /^[a-z][\w+.-]*:/i.test(v) ? v : `https://${v}`
  try {
    const u = new URL(withScheme)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return undefined
    return { href: u.href, label: u.host.replace(/^www\./, '') }
  } catch {
    return undefined
  }
}
