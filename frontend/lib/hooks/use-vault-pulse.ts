"use client";

import { useQuery } from "@tanstack/react-query";
import { useEventFluxProgram } from "./use-eventflux-program";

export const useVaultPulse = () => {
  const { program } = useEventFluxProgram();

  return useQuery({
    queryKey: ["eventflux", "vault-state"],
    enabled: Boolean(program),
    queryFn: async () => {
      if (!program) {
        return {
          deposited: 0,
          withdrawn: 0,
          yield: 0,
        };
      }

      const vaultStates = await program.account.vaultState.all();
      const aggregate = vaultStates.reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (acc: { deposited: number; withdrawn: number; yield: number }, { account }: any) => {
          acc.deposited += Number(account.totalDeposited);
          acc.withdrawn += Number(account.totalWithdrawn);
          acc.yield += Number(account.totalYieldHarvested);
          return acc;
        },
        { deposited: 0, withdrawn: 0, yield: 0 }
      );

      return aggregate;
    },
    placeholderData: {
      deposited: 12_500_000_000,
      withdrawn: 8_250_000_000,
      yield: 2_140_000_000,
    },
  });
};
