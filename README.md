# EventFlux - On-Chain Event Ticketing with Yield Vaults & x402 AI Payments

<div align="center">

![Solana](https://img.shields.io/badge/Solana-9945FF?style=for-the-badge&logo=solana&logoColor=white)
![Anchor](https://img.shields.io/badge/Anchor-0.32-blue?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)

**A production-ready Solana dApp for event ticketing with auto-yield vaults, loyalty NFTs, and x402 AI agent payments.**

[Live Demo](http://localhost:3000) · [Program ID](https://explorer.solana.com/address/Akk9YtTtkqG9K8PdbqtKd2k6zDF2egc8xnkdMWD2nvaU?cluster=devnet) · [Architecture](#architecture)

</div>

---

## Features

### Core Event Platform
- **Create Events** - Organizers define tiered passes, venue, dates, and yield strategies
- **Mint Passes** - Attendees purchase PDA-based passes with SOL
- **Check-In System** - QR scanner + manual entry for verifiers with double-scan protection
- **Treasury Management** - Post-event withdrawal with settlement tracking

### DeFi Integration
- **Yield Vaults** - Ticket revenue auto-deposits into composable vault adapters
- **CPI Architecture** - Demonstrates Kamino/Sanctum-style yield harvesting
- **Loyalty NFTs** - POAP-style rewards for checked-in attendees

### AI Agent Commerce (x402)
- **HTTP 402 Protocol** - Machine-to-machine payments for API access
- **Solana Native** - Pay with SOL directly, no bridges required
- **Protected Endpoints** - Event data, analytics, and programmatic minting

---

## Quick Start

### Prerequisites
- Node.js 18+
- Rust 1.70+
- Solana CLI 1.18+
- Anchor CLI 0.32+

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/eventflux.git
cd eventflux

# Install Anchor dependencies
cd anchor_project
yarn install

# Install frontend dependencies
cd ../frontend
npm install
```

### Run the Frontend

```bash
cd frontend
cp .env.example .env.local  # Optional: customize RPC
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and connect a Solana devnet wallet.

### Run Anchor Tests

```bash
cd anchor_project
COPYFILE_DISABLE=1 SBF_SDK_PATH=$HOME/.local/share/solana/install/releases/v1.18.20/solana-release/bin/sdk/sbf anchor test
```

---

## Architecture

```
eventflux/
├── anchor_project/
│   ├── programs/
│   │   ├── anchor_project/     # Core EventFlux program
│   │   │   └── src/lib.rs      # 6 instructions, 3 accounts
│   │   └── vault_stub/         # Mock yield adapter (CPI target)
│   └── tests/                  # Mocha + Anchor test suite
│
└── frontend/
    ├── app/                    # Next.js 16 App Router
    │   ├── api/x402/           # x402 payment endpoints
    │   ├── events/[eventId]/   # Event detail pages
    │   ├── verify/             # QR scanner for check-in
    │   └── claim/              # Guest pass minting
    ├── components/
    │   ├── dashboard/          # Organizer, Attendee, Verifier panels
    │   └── ui/                 # Buttons, Cards, Transaction status
    └── lib/
        ├── hooks/              # useTransaction, useX402, etc.
        ├── x402/               # x402 client/server implementation
        └── errors.ts           # Error categorization
```

---

## Program Instructions

| Instruction | Description | Access |
|------------|-------------|--------|
| `create_event` | Initialize event + vault PDAs, set tiers | Organizer |
| `mint_pass` | Create pass PDA, transfer SOL to vault | Attendee |
| `check_in` | Mark attendance, prevent double-scans | Verifier/Self |
| `withdraw_treasury` | Settle funds post-event | Organizer |
| `harvest_yield` | CPI to vault adapter for yield | Organizer |
| `issue_loyalty_nft` | Mint POAP-style NFT for checked-in | Organizer |

### PDA Seeds

```rust
Event:        ["event", organizer, event_id]
VaultState:   ["vault-state", event]
VaultTreasury: ["vault-treasury", event]
EventPass:    ["event-pass", event, attendee, tier_id]
LoyaltyMint:  ["loyalty-mint", event_pass]
```

---

## x402 Payment Protocol

EventFlux implements the [x402 protocol](https://github.com/coinbase/x402) for AI agent commerce on Solana.

### Protected Endpoints

| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /api/x402/events` | 0.0005 SOL | List all events with analytics |
| `GET /api/x402/events/:id` | 0.001 SOL | Detailed event data + passes |

### Integration Example

```typescript
import { createX402Client } from "@payai/x402-solana";

const client = createX402Client({
  wallet: agentWallet,
  network: "solana-devnet",
});

// Automatic 402 handling + payment
const response = await client.fetch("/api/x402/events");
const { events } = await response.json();
```

### How It Works

1. Client makes request to protected endpoint
2. Server returns `HTTP 402` with payment requirements
3. Client signs and sends SOL transaction
4. Client retries with `X-PAYMENT` header containing tx signature
5. Server verifies on-chain, returns data with `X-PAYMENT-RESPONSE`

---

## Security

### On-Chain Protections
- PDA validation with proper bump constraints
- Access control chains (organizer → verifiers → self)
- Checked arithmetic for all calculations
- Double check-in prevention
- Settlement guard (single withdrawal)

### Auditable Patterns
- All state transitions logged in account data
- Vault treasury isolation from program logic
- CPI safety with explicit account lists

---

## Testing

### Test Coverage

| Instruction | Happy Path | Error Cases |
|-------------|------------|-------------|
| create_event | ✅ | Invalid schedule |
| mint_pass | ✅ | Tier sold out |
| check_in | ✅ | Unauthorized, double scan |
| withdraw_treasury | ✅ | Not ended, already settled |
| harvest_yield | ✅ | No strategy, invalid amount |
| issue_loyalty_nft | ✅ | Not checked in, already issued |

### Running Tests

```bash
cd anchor_project
anchor test  # Full suite with local validator
```

---

## Environment Variables

### Frontend (.env.local)

```env
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_EVENTFLUX_PROGRAM_ID=Akk9YtTtkqG9K8PdbqtKd2k6zDF2egc8xnkdMWD2nvaU
NEXT_PUBLIC_EVENTFLUX_ADAPTER_ID=9zDeQgUTkwW1X2xW9ZZcACToGt9Lzoz1nAm88PtMu912
EVENTFLUX_X402_TREASURY=HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH
EVENTFLUX_X402_ENABLED=true
```

---

## Deployment

### Anchor Program

```bash
cd anchor_project
anchor build
anchor deploy --provider.cluster devnet
```

### Frontend (Vercel)

```bash
cd frontend
vercel --prod
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Smart Contract | Rust, Anchor 0.32 |
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS 4, Framer Motion |
| State | React Query, Anchor SDK |
| Wallet | Solana Wallet Adapter |
| Payments | x402 Protocol (Solana native) |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built for the Solana ecosystem**

[Twitter](https://twitter.com/eventflux) · [Discord](https://discord.gg/eventflux) · [Docs](https://docs.eventflux.app)

</div>
