# Wallet Bodyguard

_Your wallet, with a bodyguard._

A wallet dashboard built with [Lovable](https://lovable.dev)'s stack. Connect a browser wallet to:

- **Wallet Galaxy**: an animated orbit map of everyone a wallet transacts with — closer and bigger means more transactions; shape + colour mark apps, wallets and tokens; hover for details, click to open, or switch to a list view
- a **holographic wallet card** that tilts with a moving sheen and flips to your receive QR code
- **confetti** 🎉 on confirmed sends, created locks, withdrawals, batch revokes and proofs (off with reduced motion)
- see ETH and USDC balances on Ethereum, Base and Sepolia at once, with USD values and a total
- see **every token** held on each network with USD values, with scam/spam airdrops hidden automatically (website-in-name bait, explorer-flagged scams, fake USDC/USDT/WETH/DAI contracts and look-alike Cyrillic/Greek letters)
- browse **NFTs** per network as an image gallery (ERC-721 and ERC-1155 with counts); spam collections are hidden and their images never loaded
- send ETH or USDC to an address or ENS name on any of those networks (use Sepolia to test for free)
- **Scam Shield** checks every recipient before you sign: look-alike (address-poisoning) addresses, token contracts, the zero address, smart contracts and brand-new addresses, plus the network fee in USD
- track transfers sent from the app, with live confirmation status
- **contacts**: save addresses by nickname, pick them in Send or type `send 5 usdc to mum`; Scam Shield confirms saved contacts and flags look-alikes of them
- receive funds by QR code or copied address
- get warned (and switch in one click) when the wallet is on an unsupported network
- show every value in **USD, ₦ NGN, EUR or GBP** (header picker or `show in naira`)
- switch between light and dark mode
- **install it like an app** on phone or desktop (web app manifest, maskable icons, install button where the browser supports it)
- **Command bar** (Ctrl/⌘ K): type `send 5 usdc to vitalik.eth on base`, `switch to sepolia`, `gas`, `wrapped vitalik.eth`… parsed locally, always reviewed before signing
- **Proof of ownership**: sign a free message (with an optional purpose / challenge word) to get a link and QR; anyone opening it sees Verified or Not verified, checked in their browser — works for regular wallets and smart wallets (ERC-1271 / ERC-6492)
- **View any wallet** (`#/view/<address | name.eth | contact>`): a read-only dashboard — portfolio, tokens with spam filter, recent transactions in plain English — with one-click Wrap / Watch / Save contact and the wallet's ENS profile (avatar, bio, X, GitHub, website), no connection needed
- **Savings Lock** (Lock tab): deploy your own time-locked piggy bank contract (`contracts/SavingsLock.sol`), lock ETH until a date (max 5 years), let anyone top it up, and withdraw only after the unlock — with countdown, progress and a real-money acknowledgement off Sepolia
- **Whale Watch**: follow up to 10 wallets (address or ENS) on Ethereum and Base; a live feed polls every 30 s and new moves get a NEW badge, a tab-title counter and an optional desktop notification
- **Wallet health score** (Guard tab): a 0–100 score and A–F grade from risky approvals, scam tokens and an **address-poisoning detector** that scans token-transfer history for zero-value or dust transfers from look-alikes of addresses you really use (or your own), showing each fake next to the real one with the differences highlighted
- **Approval Guard**: finds every token allowance and NFT operator approval the wallet ever granted (via explorer logs), checks which are still active on-chain, flags unlimited amounts, wallet (non-contract) spenders and unverified contracts, and revokes with one click — or, on wallets that support EIP-5792 batching (smart wallets / EIP-7702), revokes every risky approval with a single signature
- **Payment links**: request an amount of ETH or USDC on a chosen network, share the link or QR, and the payer gets a pre-filled, Scam-Shield-checked payment page that only pays on the requested network; **split the bill** between up to 50 people (each share rounded up to the token's smallest unit)
- **Transaction explainer**: paste any tx hash (or type it in the command bar) and get a plain-English headline — swaps, sends, mints, approvals (with unlimited-approval warnings), NFT operator grants and failures with reasons — plus token movements and fees in USD; searches Ethereum, Base and Sepolia
- **Block pulse**: a live strip of the latest Base or Ethereum blocks — each tile drops in as a block lands, filled to how full it was, with transaction counts and details on hover
- **Live gas tracker**: current gas and the USD cost of common actions on each network, with the cheapest highlighted, plus a **gas alert** that notifies you when Ethereum or Base gas drops below your target, and an **ETH price alert** (above/below a price in your chosen currency)
- **Wallet Wrapped**: an auto-playing story (5 s per slide, hold to pause, tap or arrow keys to skip, numbers count up) recapping of any wallet (yours or any address / ENS name) — transactions, wallet age, favourite contract, prime time, fees and an on-chain personality — with a downloadable share card and a share-on-X link. History comes from Blockscout's free public API.

Tech:

- **Vite + React + TypeScript**
- **Tailwind CSS v4 + shadcn/ui**: `components.json` is set up, so `npx shadcn@latest add <component>` works
- **wagmi + viem + TanStack Query**: wallet connect, balance and network switching on Ethereum, Base and Sepolia

## Live site

Every push to `main` deploys to both:

- **Vercel:** https://walletbodyguard.vercel.app
- **GitHub Pages:** https://ramadan904.github.io/lovable-web3-app/

## Smart contract

`contracts/` holds the Savings Lock source, a pinned compile script and a 17-check test suite (including time travel past the unlock). See `contracts/README.md`; the app imports the compiled artifact, so the deployed bytecode is reproducible from the source.

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
  lib/holdings.ts                 token list parsing + scam-token filter
  lib/nfts.ts                     NFT parsing, ipfs/ar URL resolution, spam filter
  lib/shield.ts                   Scam Shield recipient checks
  lib/sendDraft.ts                pre-fill the Send form from anywhere
  lib/contacts.ts                 nickname address book (browser storage)
  lib/txText.ts                   one-line tx descriptions + relative times
  lib/links.ts                    sanitise ENS social/website records into safe links
  lib/command.ts                  plain-English command parser
  lib/route.ts                    hash routes (#/, #/gas, #/wrapped/<who>, #/pay?…)
  lib/payLink.ts                  build and validate payment-request links
  lib/blockscout.ts               explorer API client for Wrapped
  lib/wrapped.ts                  Wrapped stats and personality rules
  lib/approvals.ts                Approval Guard scanner and risk rules
  lib/galaxy.ts                   counterparty grouping + orbit layout
  lib/poisoning.ts                address-poisoning detector + health score
  lib/useHoldings.ts              cached token-holdings query
  lib/savingsLock.ts              Savings Lock ABI, bytecode and local vault list
  lib/watchlist.ts                Whale Watch list (browser storage)
  lib/proof.ts                    proof-of-ownership message and link format
  lib/explain.ts                  transaction → plain-English rules
  lib/wallet.ts                   wallet-picker helpers
  lib/activity.ts                 sent-transaction history (browser storage)
  lib/theme.ts                    light / dark mode
  components/ConnectButton.tsx    header connect / account control
  components/ConnectCard.tsx      connect prompt on the landing page
  components/NetworkBanner.tsx    unsupported-network warning
  components/CommandBar.tsx       Ctrl/⌘ K command palette
  components/dashboard/           Portfolio, TokensCard, NftsCard, SendCard, ShieldPanel, ReceiveCard, RequestCard, ContactsCard, ActivityCard
  components/approvals/           Approval Guard page
  components/watch/               Whale Watch page
  components/lock/                Savings Lock page
  components/view/                read-only view of any wallet
  components/proof/               create / verify ownership proofs
  components/explain/             transaction explainer page
  components/Landing.tsx          signed-out feature showcase
  components/gas/                 live gas tracker
  components/pay/                 payment-request page
  components/wrapped/             Wallet Wrapped story + share-card renderer
  components/ui/                  shadcn/ui components
```

## Configuration (optional)

The app works with no configuration, using each chain's public RPC. Public RPCs
are rate-limited, so for production set any of these environment variables
(Vercel → Project → Settings → Environment Variables, and GitHub → Settings →
Secrets and variables → Actions for the Pages build; locally, a `.env.local` file):

| Variable | What it does |
| --- | --- |
| `VITE_ALCHEMY_KEY` | One Alchemy key; RPC URLs are built for every supported chain |
| `VITE_RPC_ETHEREUM`, `VITE_RPC_BASE`, `VITE_RPC_SEPOLIA`, `VITE_RPC_ARBITRUM`, `VITE_RPC_OPTIMISM`, `VITE_RPC_POLYGON` | A full RPC URL for one chain (Infura, QuickNode, Alchemy, your own node…). Takes priority over `VITE_ALCHEMY_KEY` |
| `VITE_WALLETCONNECT_PROJECT_ID` | Reown/WalletConnect project ID from cloud.reown.com; enables the WalletConnect QR / mobile wallet option |

Requests go to the configured RPCs first and fall back to the public RPC if they
fail (see `src/lib/rpc.ts`). Rebuild after changing a value.

**These values are public.** Vite inlines every `VITE_*` variable into the
JavaScript bundle, so anyone can read them. Restrict each key to your domains
(e.g. `walletbodyguard.vercel.app`, `ramadan904.github.io`, `localhost`) in the
provider's dashboard, and never put a secret that can spend money or sign
anything in a `VITE_*` variable.

## Adding chains or wallets

Edit `src/lib/wagmi.ts`: add the chain from `wagmi/chains` to `chains` and to
`transports` (using `transportFor(chain.id)`), and add its Alchemy subdomain and
env name in `src/lib/rpc.ts`. Browser wallets that support EIP-6963 are detected
automatically.
