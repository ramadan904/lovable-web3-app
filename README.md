# Lovable Web3 App

A wallet dashboard built with [Lovable](https://lovable.dev)'s stack. Connect a browser wallet to:

- see ETH and USDC balances on Ethereum, Base and Sepolia at once, with USD values and a total
- send ETH or USDC to an address or ENS name on any of those networks (use Sepolia to test for free)
- **Scam Shield** checks every recipient before you sign: look-alike (address-poisoning) addresses, token contracts, the zero address, smart contracts and brand-new addresses, plus the network fee in USD
- track transfers sent from the app, with live confirmation status
- receive funds by QR code or copied address
- get warned (and switch in one click) when the wallet is on an unsupported network
- switch between light and dark mode
- **Command bar** (Ctrl/⌘ K): type `send 5 usdc to vitalik.eth on base`, `switch to sepolia`, `gas`, `wrapped vitalik.eth`… parsed locally, always reviewed before signing
- **Payment links**: request an amount of ETH or USDC on a chosen network, share the link or QR, and the payer gets a pre-filled, Scam-Shield-checked payment page that only pays on the requested network
- **Live gas tracker**: current gas and the USD cost of common actions on each network, with the cheapest highlighted
- **Wallet Wrapped**: a story-style recap of any wallet (yours or any address / ENS name) — transactions, wallet age, favourite contract, prime time, fees and an on-chain personality — with a downloadable share card and a share-on-X link. History comes from Blockscout's free public API.

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
  lib/shield.ts                   Scam Shield recipient checks
  lib/sendDraft.ts                pre-fill the Send form from anywhere
  lib/command.ts                  plain-English command parser
  lib/route.ts                    hash routes (#/, #/gas, #/wrapped/<who>, #/pay?…)
  lib/payLink.ts                  build and validate payment-request links
  lib/blockscout.ts               explorer API client for Wrapped
  lib/wrapped.ts                  Wrapped stats and personality rules
  lib/wallet.ts                   wallet-picker helpers
  lib/activity.ts                 sent-transaction history (browser storage)
  lib/theme.ts                    light / dark mode
  components/ConnectButton.tsx    header connect / account control
  components/ConnectCard.tsx      connect prompt on the landing page
  components/NetworkBanner.tsx    unsupported-network warning
  components/CommandBar.tsx       Ctrl/⌘ K command palette
  components/dashboard/           Portfolio, SendCard, ShieldPanel, ReceiveCard, ActivityCard
  components/gas/                 live gas tracker
  components/pay/                 payment-request page
  components/wrapped/             Wallet Wrapped story + share-card renderer
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
