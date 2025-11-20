# EventFlux Frontend

Next.js 16 (App Router) UI for EventFlux. It showcases the hero landing story, organizer cockpit, and attendee mint view. React Query powers live updates from the Anchor program while wallet adapter handles Phantom/Solflare/Backpack/Torus connections.

## Prerequisites
- Node 20+
- Solana wallet with devnet funds
- Anchor program deployed on devnet (defaults to `Akk9YtTtkqG9K8PdbqtKd2k6zDF2egc8xnkdMWD2nvaU`)

## Setup
```bash
cp .env.example .env.local   # override RPC/program IDs if needed
npm install
npm run dev
```
Visit **http://localhost:3000** and connect a devnet wallet.

## Available Flows
- **Organizer cockpit** – fill the form, click _Prepare create_event_, and a live Anchor transaction seeds the event + vault PDAs.
- **Attendee view** – select an event card and mint a pass (uses `mint_pass` instruction). The UI falls back to curated placeholder events if devnet is empty.
- **Vault stats** – React Query fetches every VaultState account and aggregates deposits/withdrawals/yield; placeholders appear before the first fetch resolves.

## Scripts
```bash
npm run dev     # Next dev server
npm run build   # Production build
npm start       # Serve production build
npm run lint    # ESLint (must pass before submission)
```

## Future Enhancements
- Wire check-in/withdraw/loyalty CTA buttons directly to their Anchor instructions
- Add Solana Pay QR check-in experience and GSAP microinteractions for minted passes
- Deploy to Vercel with environment variables sourced from `.env.local`
