"use client";

/**
 * React Hook for x402 Payments
 *
 * Provides an easy way to interact with x402-protected APIs
 * in React components with automatic wallet integration.
 */

import { useCallback, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  createX402Client,
  X402ClientConfig,
  PaymentRequirement,
  PaymentSettlementResponse,
  parseSettlementResponse,
} from "@/lib/x402";
import { solanaNetwork, rpcEndpoint } from "@/lib/env";

interface UseX402Options {
  maxPaymentAmount?: bigint;
}

interface X402FetchState {
  loading: boolean;
  error: string | null;
  paymentRequired: PaymentRequirement | null;
  settlement: PaymentSettlementResponse | null;
}

/**
 * Hook for making x402-protected API requests
 */
export function useX402(options: UseX402Options = {}) {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [state, setState] = useState<X402FetchState>({
    loading: false,
    error: null,
    paymentRequired: null,
    settlement: null,
  });

  const config: X402ClientConfig = {
    network: solanaNetwork === "mainnet-beta" ? "solana" : "solana-devnet",
    rpcUrl: rpcEndpoint,
    maxPaymentAmount: options.maxPaymentAmount ?? BigInt(LAMPORTS_PER_SOL), // 1 SOL default max
  };

  /**
   * Check the price of a resource without paying
   */
  const checkPrice = useCallback(
    async (url: string): Promise<number | null> => {
      try {
        const response = await fetch(url, { method: "HEAD" });
        if (response.status !== 402) return null;

        const body = await response.json();
        const requirement = body.accepts?.[0];
        if (!requirement) return null;

        return Number(requirement.maxAmountRequired) / LAMPORTS_PER_SOL;
      } catch {
        return null;
      }
    },
    []
  );

  /**
   * Fetch a resource with automatic x402 payment handling
   */
  const x402Fetch = useCallback(
    async <T = unknown>(url: string, init?: RequestInit): Promise<T | null> => {
      setState({
        loading: true,
        error: null,
        paymentRequired: null,
        settlement: null,
      });

      try {
        // First, try without payment
        const initialResponse = await fetch(url, init);

        // If not 402, return data
        if (initialResponse.status !== 402) {
          const data = await initialResponse.json();
          setState((prev) => ({ ...prev, loading: false }));
          return data as T;
        }

        // Parse 402 response
        const paymentRequired = await initialResponse.json();
        const requirement = paymentRequired.accepts?.[0] as PaymentRequirement;

        if (!requirement) {
          setState({
            loading: false,
            error: "No compatible payment options",
            paymentRequired: null,
            settlement: null,
          });
          return null;
        }

        setState((prev) => ({
          ...prev,
          paymentRequired: requirement,
        }));

        // Check wallet connection
        if (!wallet.connected || !wallet.publicKey || !wallet.signTransaction) {
          setState({
            loading: false,
            error: "Wallet not connected. Connect wallet to pay for access.",
            paymentRequired: requirement,
            settlement: null,
          });
          return null;
        }

        // Create x402 client and make paid request
        const client = createX402Client(wallet, connection, config);
        const paidResponse = await client.fetch(url, init);

        if (!paidResponse.ok) {
          const errorData = await paidResponse.json().catch(() => ({}));
          setState({
            loading: false,
            error: errorData.error ?? `Request failed: ${paidResponse.status}`,
            paymentRequired: requirement,
            settlement: null,
          });
          return null;
        }

        // Parse settlement response
        const settlementHeader = paidResponse.headers.get("X-PAYMENT-RESPONSE");
        const settlement = settlementHeader
          ? parseSettlementResponse(settlementHeader)
          : null;

        const data = await paidResponse.json();

        setState({
          loading: false,
          error: null,
          paymentRequired: requirement,
          settlement,
        });

        return data as T;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error occurred";
        setState({
          loading: false,
          error: message,
          paymentRequired: null,
          settlement: null,
        });
        return null;
      }
    },
    [wallet, connection, config]
  );

  return {
    ...state,
    x402Fetch,
    checkPrice,
    isWalletReady: wallet.connected && !!wallet.signTransaction,
  };
}

/**
 * Format a price in lamports as SOL string
 */
export function formatSolPrice(lamports: string | number | bigint): string {
  const sol = Number(lamports) / LAMPORTS_PER_SOL;
  return sol < 0.001 ? `${sol.toFixed(6)} SOL` : `${sol.toFixed(4)} SOL`;
}
