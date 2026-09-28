import { useState, type FormEvent } from 'react'
import { isAddress } from 'viem'
import { BookUser, Plus, Send, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { addContact, removeContact, useContacts } from '@/lib/contacts'
import { fillSendDraft } from '@/lib/sendDraft'
import { shortenAddress } from '@/lib/utils'

export function ContactsCard() {
  const contacts = useContacts()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState<string>()

  function onAdd(e: FormEvent) {
    e.preventDefault()
    if (!isAddress(address)) return setError('Enter a full 0x address.')
    const problem = addContact(name, address)
    setError(problem)
    if (!problem) {
      setName('')
      setAddress('')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookUser className="size-5" /> Contacts
        </CardTitle>
        <CardDescription>
          Save people by nickname, then type “send 5 usdc to {contacts[0]?.name ?? 'mum'}”. Saved in this browser only.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={onAdd} className="grid gap-2 sm:grid-cols-[8rem_1fr_auto]">
          <Input placeholder="mum" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nickname" />
          <Input
            placeholder="0x…"
            value={address}
            onChange={(e) => setAddress(e.target.value.trim())}
            className="font-mono"
            aria-label="Contact address"
            spellCheck={false}
            autoComplete="off"
          />
          <Button type="submit" aria-label="Save contact">
            <Plus />
          </Button>
        </form>
        {error && <p className="text-destructive text-xs">{error}</p>}
        {contacts.length === 0 ? (
          <p className="text-muted-foreground text-sm">No contacts yet.</p>
        ) : (
          <ul className="divide-y">
            {contacts.map((c) => (
              <li key={c.address} className="flex items-center gap-2 py-2">
                <span className="bg-muted flex size-8 items-center justify-center rounded-full text-xs font-semibold uppercase">
                  {c.name.slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="text-muted-foreground font-mono text-xs">{shortenAddress(c.address)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Send to ${c.name}`}
                  onClick={() => fillSendDraft({ to: c.name })}
                >
                  <Send />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${c.name}`}
                  onClick={() => removeContact(c.address)}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
