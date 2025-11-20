import { Keypair, PublicKey } from "@solana/web3.js";

export type UiEvent = {
  publicKey: string;
  name: string;
  venue: string;
  start: string;
  end: string;
  organizer: string;
  totalPasses: number;
  tiers: Array<{
    tierId?: number;
    tier: string;
    price: number;
    available: number;
  }>;
  strategy: string;
};

export const placeholderEvents: UiEvent[] = [
  {
    publicKey: new PublicKey("Akk9YtTtkqG9K8PdbqtKd2k6zDF2egc8xnkdMWD2nvaU").toBase58(),
    name: "EventFlux Summit",
    venue: "Metaplex Plaza, Lisbon",
    start: new Date(Date.now() + 86_400_000).toISOString(),
    end: new Date(Date.now() + 172_800_000).toISOString(),
    organizer: "EventFlux Labs",
    totalPasses: 420,
    tiers: [
      { tierId: 1, tier: "GA", price: 0.5, available: 120 },
      { tierId: 2, tier: "VIP", price: 1.5, available: 30 },
    ],
    strategy: "Kamino auto-compound",
  },
  {
    publicKey: Keypair.generate().publicKey.toBase58(),
    name: "Validator Games",
    venue: "Seoul Node Arena",
    start: new Date(Date.now() + 604_800_000).toISOString(),
    end: new Date(Date.now() + 691_200_000).toISOString(),
    organizer: "Proof of Vibes",
    totalPasses: 128,
    tiers: [
      { tierId: 1, tier: "Builder", price: 0.25, available: 42 },
      { tierId: 2, tier: "Protocol", price: 0.9, available: 16 },
    ],
    strategy: "Sanctum liquid staking",
  },
];
