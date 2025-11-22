"use client";

import { useQuery } from "@tanstack/react-query";
import { PublicKey } from "@solana/web3.js";
import { useEventFluxProgram } from "./use-eventflux-program";

export const useEventDetail = (eventAddress?: string | null) => {
  const { program } = useEventFluxProgram();

  return useQuery({
    queryKey: ["eventflux", "event-detail", eventAddress],
    enabled: Boolean(program && eventAddress),
    queryFn: async () => {
      if (!program || !eventAddress) {
        return null;
      }
      const eventPk = new PublicKey(eventAddress);
      const account = await program.account.event.fetch(eventPk);
      const vaultStatePk = new PublicKey(account.vaultState);
      const vaultState = await program.account.vaultState.fetch(vaultStatePk);
      return {
        publicKey: eventPk,
        account,
        vaultState,
      };
    },
    placeholderData: null,
  });
};
