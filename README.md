# Lovable Web3 App

A wallet dashboard built with [Lovable](https://lovable.dev)'s stack. Connect a browser wallet to:

- see ETH and USDC balances on Ethereum, Base and Sepolia at once, with USD values and a total
- send ETH or USDC on any of those networks (use Sepolia to test for free)
- track transfers sent from the app, with live confirmation status
- receive funds by QR code or copied address
- get warned (and switch in one click) when the wallet is on an unsupported network
- switch between light and dark mode

Tech:

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
  App.tsx                         header, landing page, dashboard layout
  lib/wagmi.ts                    chains, connectors and RPC transports
  lib/tokens.ts                   USDC contract addresses per chain
  lib/balances.ts                 ETH + USDC balances on every chain in one batch
  lib/prices.ts                   USD prices from CoinGecko
  lib/wallet.ts                   wallet-picker helpers
  lib/activity.ts                 sent-transaction history (browser storage)
  lib/theme.ts                    light / dark mode
  components/ConnectButton.tsx    header connect / account control
  components/ConnectCard.tsx      connect prompt on the landing page
  components/NetworkBanner.tsx    unsupported-network warning
  components/dashboard/           Portfolio, SendCard, ReceiveCard, ActivityCard
  components/ui/                  shadcn/ui components
```

## Adding chains or wallets

Edit `src/lib/wagmi.ts`. Add chains from `wagmi/chains` to both `chains` and
`transports`. Browser wallets that support EIP-6963 are detected automatically.
To add WalletConnect, install `@walletconnect/ethereum-provider` and add
`walletConnect({ projectId })` from `wagmi/connectors`.

The default `http()` transports use public RPC endpoints, which are
rate-limited. For production, pass your own RPC URL, e.g.
`http(import.meta.env.VITE_MAINNET_RPC_URL)`.
