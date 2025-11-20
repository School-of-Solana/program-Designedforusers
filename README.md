# EventFlux – On-Chain Event Pass & Yield Vault

EventFlux is a Solana dApp that lets organizers mint verifiable event passes, auto-deposit ticket proceeds into whitelisted yield vaults, and reward attendees with loyalty NFTs once they check in. The repository contains two workspaces:

- `anchor_project/` – Anchor program + TypeScript tests
- `frontend/` – Next.js 16 App Router UI with wallet adapter + React Query data layer

## Quick Links
- **Program ID (devnet)**: `Akk9YtTtkqG9K8PdbqtKd2k6zDF2egc8xnkdMWD2nvaU`
- **Vault adapter program ID**: `9zDeQgUTkwW1X2xW9ZZcACToGt9Lzoz1nAm88PtMu912`
- **IDL**: generated in `anchor_project/target/idl/anchor_project.json` and mirrored to `frontend/lib/eventflux-idl.json`

## Running the Anchor workspace
```bash
cd anchor_project
# compile the Anchor + vault stub programs
echo "Ensure the Solana SBF SDK is installed"  # helper note
SBF_SDK_PATH=$HOME/.local/share/solana/install/releases/v1.18.20/solana-release/bin/sdk/sbf anchor build

# run the full mocha + validator suite (uses COPYFILE_DISABLE to avoid macOS resource forks)
COPYFILE_DISABLE=1 SBF_SDK_PATH=$HOME/.local/share/solana/install/releases/v1.18.20/solana-release/bin/sdk/sbf anchor test
```
Tests cover happy + failure paths for create_event, mint_pass, check_in, withdraw_treasury, harvest_yield, and issue_loyalty_nft using the in-repo vault stub CPI.

## Running the frontend demo
```bash
cd frontend
cp .env.example .env.local  # edit RPC + program IDs if needed
npm install
npm run dev
```
Open http://localhost:3000, connect a devnet wallet (Phantom/Solflare/Backpack/Torus supported), and use:
1. **Organizer cockpit** – prepares and sends `create_event` with PDA derivations + default tiers.
2. **Attendee view** – executes `mint_pass` on live events (UI falls back to curated placeholders if no events exist).

The dashboard uses React Query to hydrate Event/Vault accounts on devnet and surfaces aggregate deposit/yield stats. Additional flows (check-in, withdraw, Solana Pay QR) are stubbed for roadmap visibility in the UI copy.

## Repository Structure
```
anchor_project/
  programs/anchor_project/…   # core program logic
  programs/vault_stub/…        # mocked CPI target for yield harvesting
  tests/anchor_project.ts      # mocha + AnchorProvider tests
frontend/
  app/                         # Next.js App Router pages
  components/                  # landing + dashboard UI, providers, shared widgets
  lib/                         # Anchor IDL, PDA helpers, hooks
  public/                      # static assets (logos, QR art, etc.)
PROJECT_DESCRIPTION.md         # filled submission template
```

## Deployment status
- Anchor program + vault stub deployed to devnet (see IDs above)
- Frontend: currently demoed via local dev server; Vercel deployment pending once final polish/QA completes

## Future enhancements
- Hook up `check_in`, `withdraw_treasury`, `harvest_yield`, and `issue_loyalty_nft` buttons directly from the UI
- Add Solana Pay QR experience for verifiers + deep-link to pass owners
- Capture production screenshots/video and publish the Next.js app to Vercel
