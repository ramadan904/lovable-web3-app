import { useSyncExternalStore } from 'react'
import { getAddress, parseAbi, type Address, type Hex } from 'viem'

import artifact from '../../contracts/SavingsLock.json'

/** Typed ABI for contracts/SavingsLock.sol (checked against the compiled artifact in tests). */
export const savingsLockAbi = parseAbi([
  'constructor(uint256 _unlockTime) payable',
  'function owner() view returns (address)',
  'function unlockTime() view returns (uint256)',
  'function MAX_LOCK() view returns (uint256)',
  'function withdraw()',
  'event Deposited(address indexed from, uint256 amount)',
  'event Withdrawn(address indexed to, uint256 amount)',
  'error UnlockTimeInvalid()',
  'error NotOwner()',
  'error StillLocked(uint256 unlockTime)',
  'error TransferFailed()',
  'receive() external payable',
])

/** Bytecode compiled by contracts/compile.mjs — reproducible from contracts/SavingsLock.sol. */
export const savingsLockBytecode = artifact.bytecode as Hex

export const MAX_LOCK_SECONDS = 5 * 365 * 24 * 60 * 60
export const SOURCE_URL = 'https://github.com/ramadan904/lovable-web3-app/blob/main/contracts/SavingsLock.sol'

export type Vault = {
  address: Address
  chainId: number
  owner: Address
  unlockTime: number
  name: string
  createdAt: number
}

// Vaults this browser knows about (the contracts themselves are the source of truth for funds).
const KEY = 'savings-locks'
const listeners = new Set<() => void>()
function load(): Vault[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Vault[]
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}
let vaults = load()
function save(next: Vault[]) {
  vaults = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // storage unavailable
  }
  listeners.forEach((l) => l())
}

export function rememberVault(v: Vault) {
  const address = getAddress(v.address)
  if (vaults.some((x) => x.address === address && x.chainId === v.chainId)) return
  save([...vaults, { ...v, address, owner: getAddress(v.owner) }])
}

export function forgetVault(address: Address, chainId: number) {
  save(vaults.filter((v) => !(v.address === address && v.chainId === chainId)))
}

export function useVaults(owner?: Address) {
  const all = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => vaults,
  )
  return owner ? all.filter((v) => v.owner.toLowerCase() === owner.toLowerCase()) : all
}

/** "3d 4h", "5h 12m", "42s" */
export function countdown(seconds: number) {
  if (seconds <= 0) return 'unlocked'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${seconds % 60}s`
  return `${seconds}s`
}
