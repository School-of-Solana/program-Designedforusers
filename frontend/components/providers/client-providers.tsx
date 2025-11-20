"use client";

import { PropsWithChildren, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SolanaProvider } from "./solana-provider";

export const ClientProviders = ({ children }: PropsWithChildren) => {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <SolanaProvider>{children}</SolanaProvider>
    </QueryClientProvider>
  );
};
