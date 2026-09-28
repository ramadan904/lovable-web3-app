import ganache from 'ganache'
import { decodeErrorResult, encodeFunctionData, createPublicClient, createWalletClient, createTestClient, custom, parseEther, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { readFileSync } from 'node:fs'
const { abi, bytecode } = JSON.parse(readFileSync(new URL('./SavingsLock.json', import.meta.url), 'utf8'))
const keys = ['0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d']
const provider = ganache.provider({ logging: { quiet: true }, chain: { chainId: 1337, hardfork: 'shanghai' }, wallet: { accounts: keys.map((k) => ({ secretKey: k, balance: parseEther('100') })) } })
const chain = defineChain({ id: 1337, name: 'local', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['http://x'] } } })
const transport = custom(provider)
const pub = createPublicClient({ chain, transport })
const test = createTestClient({ chain, transport, mode: 'ganache' })
const [owner, friend] = keys.map((k) => privateKeyToAccount(k))
const wallet = (account) => createWalletClient({ chain, transport, account })
let pass = 0, fail = 0
const check = (name, cond, extra = '') => {
  if (cond) pass++
  else fail++
  console.log(cond ? 'PASS' : 'FAIL', name, extra)
}
// Raw eth_call → decoded custom-error name (works around ganache rejecting viem's call params)
async function revertName(tx) {
  try { await provider.request({ method: 'eth_call', params: [tx, 'latest'] }); return 'NO_REVERT' }
  catch (e) {
    const data = e?.data?.result ?? e?.data ?? e?.result
    try { return decodeErrorResult({ abi, data: typeof data === 'string' ? data : data?.result }).errorName } catch { return 'UNDECODED ' + JSON.stringify(e?.data ?? e?.message).slice(0, 100) }
  }
}
const expectError = async (name, tx, errName) => { const got = await revertName(tx); check(name, got === errName, `(${got})`) }
const now = async () => (await pub.getBlock()).timestamp
async function deploy(account, unlock, value = 0n) {
  const hash = await wallet(account).deployContract({ abi, bytecode, args: [unlock], value })
  const r = await pub.waitForTransactionReceipt({ hash })
  return r.contractAddress
}
const t0 = await now()
const ctorData = (u) => bytecode + u.toString(16).padStart(64, '0')
await expectError('rejects unlock in the past', { from: owner.address, data: ctorData(t0 - 10n) }, 'UnlockTimeInvalid')
await expectError('rejects unlock > 5 years', { from: owner.address, data: ctorData(t0 + 6n * 365n * 86400n) }, 'UnlockTimeInvalid')
await expectError('accepts unlock at 4 years (no revert)', { from: owner.address, data: ctorData(t0 + 4n * 365n * 86400n) }, 'NO_REVERT')
const unlock = t0 + 3600n
const vault = await deploy(owner, unlock, parseEther('1'))
check('deployed with 1 ETH', (await pub.getBalance({ address: vault })) === parseEther('1'))
check('owner stored', (await pub.readContract({ address: vault, abi, functionName: 'owner' })).toLowerCase() === owner.address.toLowerCase())
check('unlockTime stored', (await pub.readContract({ address: vault, abi, functionName: 'unlockTime' })) === unlock)
check('MAX_LOCK is 5y', (await pub.readContract({ address: vault, abi, functionName: 'MAX_LOCK' })) === 5n * 365n * 86400n)
await pub.waitForTransactionReceipt({ hash: await wallet(friend).sendTransaction({ to: vault, value: parseEther('0.5') }) })
check('friend can deposit', (await pub.getBalance({ address: vault })) === parseEther('1.5'))
const withdrawTx = (account) => ({ from: account.address, to: vault, data: encodeFunctionData({ abi, functionName: 'withdraw' }) })
await expectError('owner cannot withdraw early', withdrawTx(owner), 'StillLocked')
await expectError('stranger cannot withdraw early', withdrawTx(friend), 'NotOwner')
await test.increaseTime({ seconds: 3601 }); await test.mine({ blocks: 1 })
check('time moved past unlock', (await now()) >= unlock)
await expectError('stranger cannot withdraw after unlock', withdrawTx(friend), 'NotOwner')
await expectError('owner can withdraw after unlock (dry run)', withdrawTx(owner), 'NO_REVERT')
const before = await pub.getBalance({ address: owner.address })
const hash = await wallet(owner).writeContract({ address: vault, abi, functionName: 'withdraw' })
const r = await pub.waitForTransactionReceipt({ hash })
const after = await pub.getBalance({ address: owner.address })
check('owner withdraw succeeds', r.status === 'success')
check('vault emptied', (await pub.getBalance({ address: vault })) === 0n)
check('owner received exactly 1.5 ETH (+gas)', after - before + r.gasUsed * r.effectiveGasPrice === parseEther('1.5'))
// deposits after withdraw still work and are withdrawable again
await pub.waitForTransactionReceipt({ hash: await wallet(friend).sendTransaction({ to: vault, value: parseEther('0.1') }) })
const r2 = await pub.waitForTransactionReceipt({ hash: await wallet(owner).writeContract({ address: vault, abi, functionName: 'withdraw' }) })
check('re-deposit + withdraw works', r2.status === 'success' && (await pub.getBalance({ address: vault })) === 0n)
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
