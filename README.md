# Upsilon — Real Estate RWA Platform

Fractional real estate ownership powered by **official ERC-3643 T-REX** security tokens. Investors pay **native ETH** on the primary market

> **Demo / portfolio project** — KYC is simulated via an API shim (ONCHAINID claim + Identity Registry). Not production-ready; no third-party KYC vendor.

## Architecture

```
                    ┌──────────────┐
                    │  Express API │── registerIdentity / claims ──┐
                    │  :4000       │                               │
                    └──────▲───────┘                               ▼
                           │                    ┌──────────────────────────────┐
┌─────────────┐  KYC, props│                    │  Sepolia (chain 11155111)    │
│  Next.js    │────────────┘                    │  T-REX v4.1.3 · ONCHAINID    │
│  :3000      │────── buy (ETH, wallet) ───────▶│  PropertySale · KORA token   │
└─────────────┘                                 └──────────────────────────────┘
```

### Smart Contracts

| Component | Purpose |
|---|---|
| **T-REX Token** (`KORA`) | ERC-3643 security token — Koramangala Skyrise |
| **Identity Registry** | On-chain KYC — `isVerified()` gate |
| **Modular Compliance** | Transfer rules enforced on every move |
| **PropertySale** | Primary market — pay ETH → receive KORA |
| **ONCHAINID** | Identity contracts + demo claim issuer |

## Quick Start

### Prerequisites

- Node.js 20+
- MetaMask or compatible wallet
- Sepolia ETH ([faucet](https://sepoliafaucet.com/))

### Install

```bash
npm install
cp apps/api/.env.example apps/api/.env.local
cp apps/web/.env.example apps/web/.env
```

Set `DEPLOYER_PRIVATE_KEY` in `apps/api/.env.local` (wallet with Sepolia ETH for deploy + KYC agent).

### Deploy contracts (Sepolia)

```bash
npm run compile -w packages/contracts
npm run deploy:sepolia
```

Deploy takes ~15–30 minutes (~30 txs). Writes `deployments.json` to `apps/api` and `apps/web`, and updates `apps/api/.env.local` with the claim issuer key.

### Run app

```bash
npm run dev
```

- Frontend: http://localhost:3000
- API: http://localhost:4000

### Connect wallet

1. Switch MetaMask to **Sepolia** (chain ID `11155111`)
2. Fund the wallet with Sepolia ETH
3. Connect via the app header

### Test flow

1. **KYC** — `/kyc` → submit or use "Verify instantly" (demo)
2. **Invest** — `/properties/koramangala-skyrise` → buy KORA with ETH (0.01 ETH per token)
3. **Portfolio** — `/portfolio` → view on-chain balance

Complete KYC before buying — unverified wallets cannot receive KORA.

## Project Structure

```
Upsilon/
├── packages/contracts/
│   ├── contracts/
│   │   ├── PropertySale.sol
│   │   └── vendor/
│   │       ├── erc3643/       # T-REX (Token, IdentityRegistry, Compliance, …)
│   │       └── onchain-id/    # ONCHAINID (Identity, ClaimIssuer, …)
│   ├── scripts/lib/trex.ts
│   └── test/
├── apps/
│   ├── api/                # Express API + demo KYC shim
│   └── web/                # Next.js frontend
└── package.json
```

## ERC-3643 Compliance Flow

1. Investor completes demo KYC → API creates ONCHAINID + claim → `registerIdentity()`
2. Investor buys on PropertySale with native ETH
3. Token transfer to unverified wallet → **reverted** by T-REX compliance
4. Issuer agent can pause, manage identities, etc.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start API + frontend |
| `npm run compile` | Compile Solidity contracts |
| `npm run test:contracts` | Run contract tests |
| `npm run deploy:sepolia` | Deploy T-REX suite to Sepolia |

## License

none
