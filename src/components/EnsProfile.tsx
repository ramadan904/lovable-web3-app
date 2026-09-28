import { useState } from 'react'
import { useEnsAvatar, useEnsText } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { AtSign, CodeXml, Globe } from 'lucide-react'

import { socialUrl, websiteUrl } from '@/lib/links'

/** Avatar, bio and socials from an ENS name's public records. Renders nothing if it has none. */
export function EnsProfile({ name }: { name: string }) {
  const q = { chainId: mainnet.id, query: { staleTime: 10 * 60_000 } } as const
  const avatar = useEnsAvatar({ name, ...q })
  const bio = useEnsText({ name, key: 'description', ...q })
  const x = useEnsText({ name, key: 'com.twitter', ...q })
  const gh = useEnsText({ name, key: 'com.github', ...q })
  const url = useEnsText({ name, key: 'url', ...q })
  const [broken, setBroken] = useState(false)

  const links = [
    { icon: AtSign, link: socialUrl('x', x.data) },
    { icon: CodeXml, link: socialUrl('github', gh.data) },
    { icon: Globe, link: websiteUrl(url.data) },
  ].filter((l) => l.link)
  const hasAvatar = !!avatar.data && !broken
  if (!hasAvatar && !bio.data && links.length === 0) return null

  return (
    <div className="flex items-start gap-3">
      {hasAvatar && (
        <img
          src={avatar.data!}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="size-14 shrink-0 rounded-full object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        {bio.data && <p className="text-muted-foreground line-clamp-2 text-sm">{bio.data}</p>}
        {links.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {links.map(({ icon: Icon, link }) => (
              <a
                key={link!.href}
                href={link!.href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
              >
                <Icon className="size-3.5" /> {link!.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
