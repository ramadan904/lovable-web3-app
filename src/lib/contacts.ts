import { useSyncExternalStore } from 'react'
import { getAddress, type Address } from 'viem'

export type Contact = { name: string; address: Address }

const KEY = 'contacts'
const listeners = new Set<() => void>()

function load(): Contact[] {
  try {
    const items = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Contact[]
    return Array.isArray(items) ? items : []
  } catch {
    return []
  }
}

let contacts = load()

function save(next: Contact[]) {
  contacts = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // storage unavailable: contacts last for this visit only
  }
  listeners.forEach((l) => l())
}

export const normalizeName = (name: string) => name.trim().replace(/^@/, '').toLowerCase()

/** Returns an error message, or undefined on success. */
export function addContact(name: string, address: Address) {
  const clean = name.trim().replace(/^@/, '')
  if (!/^[\w-]{1,24}$/.test(clean)) return 'Use 1–24 letters, numbers, - or _ (no spaces).'
  if (contacts.some((c) => normalizeName(c.name) === normalizeName(clean))) return 'That name is already used.'
  const a = getAddress(address)
  if (contacts.some((c) => c.address === a)) return 'That address is already saved.'
  save([...contacts, { name: clean, address: a }])
  return undefined
}

export function removeContact(address: Address) {
  save(contacts.filter((c) => c.address !== address))
}

export function findContact(nameOrAddress: string) {
  const key = normalizeName(nameOrAddress)
  return contacts.find((c) => normalizeName(c.name) === key || c.address.toLowerCase() === key)
}

export function useContacts() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => contacts,
  )
}
