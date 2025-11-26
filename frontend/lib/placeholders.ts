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
    label: string;
    price: number;
    available: number;
    maxSupply?: number;
    sold?: number;
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
      { tierId: 1, label: "GA", price: 0.5, available: 120, maxSupply: 200, sold: 80 },
      { tierId: 2, label: "VIP", price: 1.5, available: 30, maxSupply: 60, sold: 30 },
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
      { tierId: 1, label: "Builder", price: 0.25, available: 42, maxSupply: 100, sold: 58 },
      { tierId: 2, label: "Protocol", price: 0.9, available: 16, maxSupply: 40, sold: 24 },
    ],
    strategy: "Sanctum liquid staking",
  },
];
