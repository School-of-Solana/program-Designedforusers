# Project Description

**Deployed Frontend URL:** _Local demo (http://localhost:3000) – Vercel deployment pending_

**Solana Program ID:** `Akk9YtTtkqG9K8PdbqtKd2k6zDF2egc8xnkdMWD2nvaU`

## Project Overview

### Description
EventFlux is an Anchor-based event platform where organizers mint tiered passes (PDAs), ticket revenue automatically deposits into a vault PDA that accrues yield via a CPI adapter, and verifiers can check in attendees and issue loyalty NFTs. The frontend is a polished Next.js 16 experience that showcases organizer + attendee personas, live data from devnet, and curated placeholders when no events exist, making it recruiter-ready for demos.

### Key Features
- **Create Event** – Derives Event/VaultState PDAs, seeds the vault treasury, defines tiers, and stores verifier lists.
- **Mint Pass** – Attendees create EventPass PDAs, transfer SOL into the vault treasury, and increment tier supply counters.
- **Check In** – Organizer/delegated verifier marks attendance while preventing double scans; pass owner can self-check as fallback.
- **Vault Flow** – `harvest_yield` CPI pulls lamports from a mocked Kamino/Sanctum adapter; `withdraw_treasury` settles funds post-event.
- **Loyalty NFTs** – One-click `issue_loyalty_nft` mints a 0-decimal NFT PDA for each checked-in attendee.
- **Next.js Dashboard** – Wallet adapter, React Query, GSAP hero, and curated placeholder data keep the UI usable even before events exist.

### How to Use the dApp
1. **Install deps**
   ```bash
   cd anchor_project && yarn install
   cd frontend && npm install
   ```
2. **Run tests**
   ```bash
   COPYFILE_DISABLE=1 SBF_SDK_PATH=$HOME/.local/share/solana/install/releases/v1.18.20/solana-release/bin/sdk/sbf anchor test
   ```
3. **Start the UI**
   ```bash
   cd frontend
   cp .env.example .env.local   # optional RPC override
   npm run dev
   ```
4. **Organizer flow** – In the “Organizer cockpit”, tweak event metadata and click _Prepare create_event_. The form derives PDAs, dispatches `create_event`, and refreshes the query cache.
5. **Attendee flow** – Choose an event card and click _Mint pass_. Funds move into the vault PDA and the EventPass PDA is created.
6. **Roadmap actions** – Check-in/withdraw/loyalty CTAs are highlighted in copy + tests; hook-ups are noted as future work for reviewers.

## Program Architecture
EventFlux maintains one Event PDA per organizer + event ID, a VaultState PDA per event, a lamport-only vault treasury PDA, and EventPass PDAs scoped to (event, attendee, tier). Yield flows through a CPI into `vault_stub`, demonstrating how treasury funds can compound until settlement.

### PDA Usage
- **Event**: `seed("event"), organizer, event_id)` – unique metadata anchor per event.
- **VaultState**: `seed("vault-state"), event)` – strategy + ledger for deposits/withdrawals/harvests.
- **VaultTreasury**: `seed("vault-treasury"), event)` – lamport-only PDA that temporarily holds ticket proceeds.
- **EventPass**: `seed("event-pass"), event, attendee, tier_id)` – attendee pass storing tier, price, and check-in info.
- **Loyalty Mint**: `seed("loyalty-mint"), event_pass)` – 0-decimal SPL mint used for POAP-style perks.

### Program Instructions
- `create_event` – Initializes Event + VaultState, creates the vault treasury PDA, stores tiers/verifiers.
- `mint_pass` – Derives the pass PDA, transfers SOL into the vault treasury, and increments tier counters.
- `check_in` – Verifies authority and toggles attendance while blocking double check-ins.
- `withdraw_treasury` – After `end_ts`, transfers lamports back to the organizer treasury and marks the event settled.
- `harvest_yield` – CPI call into the vault adapter stub that boosts the treasury balance and updates `total_yield_harvested`.
- `issue_loyalty_nft` – Mint-to CPI using SPL Token + ATA to reward checked-in wallets.

### Account Structure
```rust
#[account]
pub struct Event {
    pub bump: u8,
    pub event_id: u64,
    pub organizer: Pubkey,
    pub settlement_treasury: Pubkey,
    pub name: String,
    pub venue: String,
    pub start_ts: i64,
    pub end_ts: i64,
    pub yield_strategy: YieldStrategy,
    pub tiers: Vec<TierConfig>,
    pub authorized_verifiers: Vec<Pubkey>,
    pub total_passes: u64,
    pub vault_state: Pubkey,
    pub settled: bool,
}

#[account]
pub struct EventPass {
    pub bump: u8,
    pub event: Pubkey,
    pub owner: Pubkey,
    pub tier_id: u8,
    pub price_paid: u64,
    pub minted_at: i64,
    pub checked_in: bool,
    pub checked_in_at: Option<i64>,
    pub loyalty_mint: Option<Pubkey>,
}

#[account]
pub struct VaultState {
    pub bump: u8,
    pub event: Pubkey,
    pub strategy: YieldStrategy,
    pub total_deposited: u64,
    pub total_withdrawn: u64,
    pub total_yield_harvested: u64,
    pub vault_treasury_bump: u8,
    pub last_harvest_ts: i64,
}
```

## Testing

### Test Coverage
TypeScript mocha tests (via `anchor test`) cover:
- Event creation + PDA derivations
- Minting passes (happy path + tier sold-out failure)
- Unauthorized verifier & double check-in errors
- Vault harvest/withdraw happy paths and CPI failures
- Loyalty NFT issuance + double-issue guardrail

### Running Tests
```bash
COPYFILE_DISABLE=1 SBF_SDK_PATH=$HOME/.local/share/solana/install/releases/v1.18.20/solana-release/bin/sdk/sbf anchor test
```

### Additional Notes for Evaluators
- The UI reads live devnet accounts; when there are no events yet, curated placeholder cards keep the dashboard informative.
- Remaining UI actions (check-in, withdraw, loyalty) are spelled out in the “product storyline” section and validated through Anchor tests.
- The mock vault adapter demonstrates CPI composition without external program dependencies, simplifying evaluation.
