"use client";

/**
 * Transaction Status Component
 *
 * Visual feedback for transaction lifecycle with animations
 * and explorer links.
 */

import { useEffect, useState } from "react";
import {
  TransactionStatus as TxStatus,
  getStatusMessage,
  getStatusColor,
} from "@/lib/hooks/use-transaction";
import { solanaNetwork } from "@/lib/env";

interface TransactionStatusProps {
  status: TxStatus;
  signature: string | null;
  error: string | null;
  suggestedAction?: string;
  className?: string;
  onDismiss?: () => void;
}

const getExplorerUrl = (signature: string): string => {
  const cluster = solanaNetwork === "mainnet-beta" ? "" : `?cluster=${solanaNetwork}`;
  return `https://explorer.solana.com/tx/${signature}${cluster}`;
};

export function TransactionStatus({
  status,
  signature,
  error,
  suggestedAction,
  className = "",
  onDismiss,
}: TransactionStatusProps) {
  const [dots, setDots] = useState("");

  // Animate dots for loading states
  useEffect(() => {
    if (!["preparing", "signing", "sending", "confirming"].includes(status)) {
      setDots("");
      return;
    }

    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 400);

    return () => clearInterval(interval);
  }, [status]);

  if (status === "idle") {
    return null;
  }

  const message = getStatusMessage(status);
  const colorClass = getStatusColor(status);

  return (
    <div
      className={`rounded-xl border p-3 text-sm transition-all duration-300 ${className} ${
        status === "confirmed"
          ? "border-emerald-500/30 bg-emerald-500/10"
          : status === "failed"
            ? "border-red-500/30 bg-red-500/10"
            : "border-white/10 bg-white/5"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Status Icon */}
          {status === "confirmed" ? (
            <svg
              className="h-4 w-4 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : status === "failed" ? (
            <svg
              className="h-4 w-4 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent text-cyan-400" />
          )}

          {/* Status Message */}
          <span className={colorClass}>
            {message}
            {["preparing", "signing", "sending", "confirming"].includes(status) && (
              <span className="inline-block w-6">{dots}</span>
            )}
          </span>
        </div>

        {/* Dismiss button */}
        {(status === "confirmed" || status === "failed") && onDismiss && (
          <button
            onClick={onDismiss}
            className="text-white/40 hover:text-white/60 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Error message */}
      {status === "failed" && error && (
        <div className="mt-2">
          <p className="text-xs text-red-400/80 break-all">{error}</p>
          {suggestedAction && (
            <p className="mt-1 text-xs text-white/50">{suggestedAction}</p>
          )}
        </div>
      )}

      {/* Explorer link */}
      {signature && (
        <div className="mt-2 flex items-center gap-2">
          <span className="font-mono text-xs text-white/40">
            {signature.slice(0, 8)}...{signature.slice(-8)}
          </span>
          <a
            href={getExplorerUrl(signature)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-cyan-400 hover:text-cyan-300 hover:underline"
          >
            View on Explorer
          </a>
        </div>
      )}
    </div>
  );
}

/**
 * Compact inline transaction status
 */
export function TransactionStatusInline({
  status,
  signature,
}: {
  status: TxStatus;
  signature: string | null;
}) {
  if (status === "idle") return null;

  const colorClass = getStatusColor(status);
  const message = getStatusMessage(status);

  return (
    <span className={`text-xs ${colorClass}`}>
      {message}
      {signature && status === "confirmed" && (
        <>
          {" "}
          <a
            href={getExplorerUrl(signature)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline"
          >
            View
          </a>
        </>
      )}
    </span>
  );
}

/**
 * Transaction toast notification
 */
export function TransactionToast({
  status,
  signature,
  error,
  onDismiss,
}: TransactionStatusProps) {
  // Auto-dismiss success after 5 seconds
  useEffect(() => {
    if (status === "confirmed" && onDismiss) {
      const timer = setTimeout(onDismiss, 5000);
      return () => clearTimeout(timer);
    }
  }, [status, onDismiss]);

  if (status === "idle") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
      <TransactionStatus
        status={status}
        signature={signature}
        error={error}
        onDismiss={onDismiss}
        className="shadow-lg shadow-black/20"
      />
    </div>
  );
}
