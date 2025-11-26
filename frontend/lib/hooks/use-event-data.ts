"use client";

import { useQuery } from "@tanstack/react-query";
import { PublicKey } from "@solana/web3.js";
import { useEventFluxProgram } from "./use-eventflux-program";
import { placeholderEvents, type UiEvent } from "@/lib/placeholders";

const lamportsToSol = (lamports: number) => lamports / 1_000_000_000;

export const useEventFeed = () => {
  const { program } = useEventFluxProgram();

  return useQuery<UiEvent[]>({
    queryKey: ["eventflux", program?.programId.toBase58()],
    enabled: Boolean(program),
    placeholderData: placeholderEvents,
    queryFn: async () => {
      if (!program) {
        return placeholderEvents;
      }

      const events = await program.account.event.all();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return events.map(({ publicKey, account }: any) => ({
        publicKey: publicKey.toBase58(),
        name: account.name,
        venue: account.venue,
        start: new Date(Number(account.startTs) * 1000).toISOString(),
        end: new Date(Number(account.endTs) * 1000).toISOString(),
        organizer: new PublicKey(account.organizer).toBase58(),
        totalPasses: Number(account.totalPasses),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tiers: account.tiers.map((tier: any) => ({
          tierId: tier.tierId,
          label: tier.label,
          price: lamportsToSol(Number(tier.priceLamports)),
          available: Number(tier.maxSupply - tier.sold),
          maxSupply: Number(tier.maxSupply),
          sold: Number(tier.sold),
        })),
        strategy: account.yieldStrategy.__kind ?? "Strategy",
      }));
    },
  });
};
