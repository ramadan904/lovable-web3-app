# Lovable Web3 App

A starter for building a Web3 front end with [Lovable](https://lovable.dev) or locally.

- **Vite + React + TypeScript**
- **Tailwind CSS v4 + shadcn/ui**: `components.json` is set up, so `npx shadcn@latest add <component>` works
- **wagmi + viem + TanStack Query**: wallet connect, balance and network switching on Ethereum, Base and Sepolia

## Live site

Every push to `main` deploys to GitHub Pages:
https://ramadan904.github.io/lovable-web3-app/

## Run locally

```sh
npm install
npm run dev      # http://localhost:8080
npm run build
npm run lint
```

## Project layout

```
src/
  lib/wagmi.ts              chains, connectors and RPC transports
  lib/utils.ts              cn() class helper, shortenAddress()
  components/WalletCard.tsx connect / balance / switch-network card
  components/ui/            shadcn/ui components
```

## Adding chains or wallets

Edit `src/lib/wagmi.ts`. Add chains from `wagmi/chains` to both `chains` and
`transports`. Browser wallets that support EIP-6963 are detected automatically.
To add WalletConnect, install `@walletconnect/ethereum-provider` and add
`walletConnect({ projectId })` from `wagmi/connectors`.

The default `http()` transports use public RPC endpoints, which are
rate-limited. For production, pass your own RPC URL, e.g.
`http(import.meta.env.VITE_MAINNET_RPC_URL)`.
