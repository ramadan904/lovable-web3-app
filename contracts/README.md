# SavingsLock

`SavingsLock.sol` is the time-locked piggy bank the app deploys from the **Lock** tab.
Each user deploys their own copy; the app never holds funds.

- Anyone can deposit ETH (plain transfer).
- Only the deployer (`owner`) can `withdraw()`, and only once `block.timestamp >= unlockTime`.
- `unlockTime` must be in the future and at most 5 years away (`MAX_LOCK`), so a typo can't lock funds for decades.
- No admin keys, no upgradeability, no fees.

It has **not** been professionally audited. It is intentionally tiny so it can be read in a minute.

## Reproduce the bytecode and run the tests

```sh
cd contracts
npm i --no-save solc@0.8.28 ganache@7 viem@2
node compile.mjs   # writes SavingsLock.json (abi + bytecode), optimizer 200 runs, evmVersion shanghai
node test.mjs      # 17 checks on an in-process chain, including time travel past the unlock
```

The app imports `SavingsLock.json`, so the deployed bytecode is exactly what `compile.mjs` produces.
