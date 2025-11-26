"use client";

/**
 * Transaction Status Hook
 *
 * Provides comprehensive transaction lifecycle management with
 * real-time status updates and confirmation tracking.
 */

import { useState, useCallback, useRef } from "react";
import { Connection, TransactionSignature } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import { categorizeError, isUserRejection, CategorizedError } from "@/lib/errors";

export type TransactionStatus =
  | "idle"
  | "preparing"
  | "signing"
  | "sending"
  | "confirming"
  | "confirmed"
  | "failed";

export interface TransactionState {
  status: TransactionStatus;
  signature: string | null;
  error: string | null;
  errorDetails: CategorizedError | null;
  confirmations: number;
  startTime: number | null;
  endTime: number | null;
}

export interface TransactionResult {
  success: boolean;
  signature: string | null;
  error: string | null;
  duration: number;
}

const INITIAL_STATE: TransactionState = {
  status: "idle",
  signature: null,
  error: null,
  errorDetails: null,
  confirmations: 0,
  startTime: null,
  endTime: null,
};

/**
 * Hook for managing transaction lifecycle with status updates
 */
export function useTransaction() {
  const { connection } = useConnection();
  const [state, setState] = useState<TransactionState>(INITIAL_STATE);
  const abortControllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState(INITIAL_STATE);
  }, []);

  const setStatus = useCallback((status: TransactionStatus) => {
    setState((prev) => ({ ...prev, status }));
  }, []);

  const setError = useCallback((error: unknown) => {
    const categorized = categorizeError(error);
    setState((prev) => ({
      ...prev,
      status: "failed",
      error: categorized.userMessage,
      errorDetails: categorized,
      endTime: Date.now(),
    }));
  }, []);

  /**
   * Execute a transaction with full lifecycle tracking
   */
  const execute = useCallback(
    async <T>(
      transactionFn: () => Promise<TransactionSignature>,
      options?: {
        onPreparing?: () => void;
        onSigning?: () => void;
        onSending?: () => void;
        onConfirming?: (signature: string) => void;
        onConfirmed?: (signature: string) => void;
        onFailed?: (error: string) => void;
        commitment?: "processed" | "confirmed" | "finalized";
      }
    ): Promise<TransactionResult> => {
      const commitment = options?.commitment ?? "confirmed";
      abortControllerRef.current = new AbortController();

      try {
        // Preparing
        setState({
          status: "preparing",
          signature: null,
          error: null,
          errorDetails: null,
          confirmations: 0,
          startTime: Date.now(),
          endTime: null,
        });
        options?.onPreparing?.();

        // Signing
        setStatus("signing");
        options?.onSigning?.();

        // Execute transaction (includes signing and sending)
        setStatus("sending");
        options?.onSending?.();

        const signature = await transactionFn();

        // Update with signature
        setState((prev) => ({
          ...prev,
          status: "confirming",
          signature,
        }));
        options?.onConfirming?.(signature);

        // Wait for confirmation
        const result = await connection.confirmTransaction(
          {
            signature,
            ...(await connection.getLatestBlockhash(commitment)),
          },
          commitment
        );

        if (result.value.err) {
          const categorized = categorizeError(result.value.err);
          setState((prev) => ({
            ...prev,
            status: "failed",
            error: categorized.userMessage,
            errorDetails: categorized,
            endTime: Date.now(),
          }));
          options?.onFailed?.(categorized.userMessage);

          return {
            success: false,
            signature,
            error: categorized.userMessage,
            duration: Date.now() - (state.startTime ?? Date.now()),
          };
        }

        // Success
        setState((prev) => ({
          ...prev,
          status: "confirmed",
          confirmations: 1,
          endTime: Date.now(),
        }));
        options?.onConfirmed?.(signature);

        return {
          success: true,
          signature,
          error: null,
          duration: Date.now() - (state.startTime ?? Date.now()),
        };
      } catch (error) {
        const categorized = categorizeError(error);

        // Check for user rejection - don't show as error
        if (isUserRejection(error)) {
          setState((prev) => ({
            ...prev,
            status: "idle",
            error: null,
            errorDetails: null,
            endTime: Date.now(),
          }));
          return {
            success: false,
            signature: null,
            error: "Transaction cancelled",
            duration: Date.now() - (state.startTime ?? Date.now()),
          };
        }

        setState((prev) => ({
          ...prev,
          status: "failed",
          error: categorized.userMessage,
          errorDetails: categorized,
          endTime: Date.now(),
        }));
        options?.onFailed?.(categorized.userMessage);

        return {
          success: false,
          signature: state.signature,
          error: categorized.userMessage,
          duration: Date.now() - (state.startTime ?? Date.now()),
        };
      }
    },
    [connection, setStatus, state.startTime, state.signature]
  );

  return {
    ...state,
    execute,
    reset,
    isLoading: ["preparing", "signing", "sending", "confirming"].includes(state.status),
    isPending: state.status === "confirming",
    isSuccess: state.status === "confirmed",
    isError: state.status === "failed",
  };
}

/**
 * Get human-readable status message
 */
export function getStatusMessage(status: TransactionStatus): string {
  switch (status) {
    case "idle":
      return "";
    case "preparing":
      return "Preparing transaction...";
    case "signing":
      return "Please approve in your wallet...";
    case "sending":
      return "Sending transaction...";
    case "confirming":
      return "Confirming on Solana...";
    case "confirmed":
      return "Transaction confirmed!";
    case "failed":
      return "Transaction failed";
    default:
      return "";
  }
}

/**
 * Get status color for UI
 */
export function getStatusColor(status: TransactionStatus): string {
  switch (status) {
    case "idle":
      return "text-white/60";
    case "preparing":
    case "signing":
    case "sending":
      return "text-amber-400";
    case "confirming":
      return "text-cyan-400";
    case "confirmed":
      return "text-emerald-400";
    case "failed":
      return "text-red-400";
    default:
      return "text-white/60";
  }
}
