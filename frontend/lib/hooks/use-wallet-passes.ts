"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { useEventFluxProgram } from "./use-eventflux-program";

export const useWalletPasses = () => {
  const wallet = useWallet();
  const { program } = useEventFluxProgram();

  return useQuery({
    queryKey: ["eventflux", "passes", wallet.publicKey?.toBase58()],
    enabled: Boolean(wallet.publicKey && program),
    queryFn: async () => {
      if (!wallet.publicKey || !program) {
        return [];
      }
      const filters = [
        {
          memcmp: {
            offset: 8 + 1 + 32, // disc + bump + event pubkey
            bytes: wallet.publicKey.toBase58(),
          },
        },
      ];
      const passes = await program.account.eventPass.all(filters);
      return passes;
    },
    placeholderData: [],
  });
};
