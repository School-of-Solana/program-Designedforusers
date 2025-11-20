"use client";

import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { useEventFluxProgram } from "./use-eventflux-program";

export const useOrganizerEvents = () => {
  const wallet = useWallet();
  const { program } = useEventFluxProgram();

  return useQuery({
    queryKey: ["eventflux", "organizer", wallet.publicKey?.toBase58()],
    enabled: Boolean(wallet.publicKey && program),
    queryFn: async () => {
      if (!wallet.publicKey || !program) {
        return [];
      }
      const filters = [
        {
          memcmp: {
            offset: 8 + 1 + 8, // disc + bump + event_id
            bytes: wallet.publicKey.toBase58(),
          },
        },
      ];
      const events = await program.account.event.all(filters);
      return events;
    },
    placeholderData: [],
  });
};
