// Compiles SavingsLock.sol → SavingsLock.json (abi + bytecode) with pinned settings.
import { readFileSync, writeFileSync } from 'node:fs'
import solc from 'solc'

const source = readFileSync(new URL('./SavingsLock.sol', import.meta.url), 'utf8')
const input = {
  language: 'Solidity',
  sources: { 'SavingsLock.sol': { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: 'shanghai',
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
}
const out = JSON.parse(solc.compile(JSON.stringify(input)))
for (const e of out.errors ?? []) console.log(e.severity, e.formattedMessage)
if ((out.errors ?? []).some((e) => e.severity === 'error')) process.exit(1)

const c = out.contracts['SavingsLock.sol'].SavingsLock
const artifact = { abi: c.abi, bytecode: `0x${c.evm.bytecode.object}`, compiler: solc.version() }
writeFileSync(new URL('./SavingsLock.json', import.meta.url), `${JSON.stringify(artifact, null, 2)}\n`)
console.log('compiled with', solc.version(), '—', c.evm.bytecode.object.length / 2, 'bytes')
