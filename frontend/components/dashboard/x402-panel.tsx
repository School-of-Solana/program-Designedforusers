"use client";

/**
 * x402 Payment Demo Panel
 *
 * Showcases the x402 payment capabilities for AI agents and developers.
 * Demonstrates how to access premium APIs with Solana payments.
 */

import { useState } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { GradientCard } from "@/components/ui/gradient-card";
import { Button } from "@/components/ui/button";
import { useX402, formatSolPrice } from "@/lib/hooks/use-x402";

interface EventData {
  publicKey: string;
  name: string;
  venue: string;
  totalPasses: number;
  yieldStrategy: string;
  vaultStats: {
    deposited: number;
    withdrawn: number;
    yieldHarvested: number;
  };
}

interface EventsResponse {
  events: EventData[];
  x402: boolean;
  payer?: string;
  timestamp?: number;
}

export const X402Panel = () => {
  const { loading, error, paymentRequired, settlement, x402Fetch, checkPrice, isWalletReady } =
    useX402({
      maxPaymentAmount: BigInt(0.1 * LAMPORTS_PER_SOL), // 0.1 SOL max
    });

  const [eventsData, setEventsData] = useState<EventsResponse | null>(null);
  const [priceCheck, setPriceCheck] = useState<number | null>(null);

  const handleCheckPrice = async () => {
    const price = await checkPrice("/api/x402/events");
    setPriceCheck(price);
  };

  const handleFetchEvents = async () => {
    const data = await x402Fetch<EventsResponse>("/api/x402/events");
    if (data) {
      setEventsData(data);
    }
  };

  return (
    <GradientCard className="space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
            x402
          </span>
          <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-purple-400">
            AI Ready
          </span>
        </div>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          HTTP 402 Payment Protocol
        </h2>
        <p className="text-sm text-white/60">
          EventFlux supports the x402 protocol for machine-to-machine payments.
          AI agents can programmatically pay for event data, analytics, and pass
          minting using Solana.
        </p>
      </header>

      {/* API Endpoints Documentation */}
      <div className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
          Available Endpoints
        </p>
        <div className="space-y-2 font-mono text-xs">
          <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
            <span className="text-emerald-400">GET /api/x402/events</span>
            <span className="text-white/40">0.0005 SOL</span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
            <span className="text-emerald-400">GET /api/x402/events/:id</span>
            <span className="text-white/40">0.001 SOL</span>
          </div>
        </div>
      </div>

      {/* Demo Section */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
          Live Demo
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="bg-white/10 text-white text-xs"
            onClick={handleCheckPrice}
            disabled={loading}
          >
            Check Price
          </Button>
          <Button
            type="button"
            className="bg-emerald-500/80 text-white text-xs"
            onClick={handleFetchEvents}
            disabled={loading || !isWalletReady}
          >
            {loading ? "Processing..." : "Fetch Events (Pay 0.0005 SOL)"}
          </Button>
        </div>

        {!isWalletReady && (
          <p className="text-xs text-amber-400/80">
            Connect your wallet to make x402 payments
          </p>
        )}

        {priceCheck !== null && (
          <div className="rounded-xl bg-white/5 p-3 text-xs">
            <span className="text-white/60">Endpoint price: </span>
            <span className="font-semibold text-emerald-400">
              {priceCheck} SOL
            </span>
          </div>
        )}

        {paymentRequired && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
            <p className="font-semibold text-amber-400">Payment Required</p>
            <p className="mt-1 text-white/60">
              Amount: {formatSolPrice(paymentRequired.maxAmountRequired)}
            </p>
            <p className="text-white/60">
              Recipient: {paymentRequired.payTo.slice(0, 8)}...
            </p>
          </div>
        )}

        {settlement && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs">
            <p className="font-semibold text-emerald-400">Payment Settled</p>
            <p className="mt-1 font-mono text-white/60">
              TX: {settlement.transactionSignature?.slice(0, 16)}...
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
            {error}
          </div>
        )}

        {eventsData && (
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <p className="text-xs font-semibold text-white/60">
              Response ({eventsData.events.length} events)
            </p>
            <div className="mt-2 max-h-48 overflow-y-auto space-y-2">
              {eventsData.events.map((event) => (
                <div
                  key={event.publicKey}
                  className="rounded-lg bg-white/5 p-2 text-xs"
                >
                  <p className="font-semibold text-white">{event.name}</p>
                  <p className="text-white/40">{event.venue}</p>
                  <div className="mt-1 flex gap-3 text-white/60">
                    <span>{event.totalPasses} passes</span>
                    <span>{event.vaultStats.deposited.toFixed(2)} SOL TVL</span>
                  </div>
                </div>
              ))}
              {eventsData.events.length === 0 && (
                <p className="text-white/40">No events found on devnet</p>
              )}
            </div>
            {eventsData.x402 && eventsData.payer && (
              <p className="mt-2 text-[10px] text-emerald-400/60">
                Paid by: {eventsData.payer.slice(0, 8)}...
              </p>
            )}
          </div>
        )}
      </div>

      {/* Code Example */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
          Integration Example
        </p>
        <pre className="overflow-x-auto rounded-xl bg-black/50 p-4 text-[11px] text-emerald-400/90">
          {`// AI Agent x402 Integration
import { createX402Client } from "@payai/x402-solana";

const client = createX402Client({
  wallet: agentWallet,
  network: "solana-devnet",
});

// Fetch automatically handles 402 + payment
const response = await client.fetch(
  "https://eventflux.app/api/x402/events"
);

const { events } = await response.json();`}
        </pre>
      </div>

      {/* Protocol Info */}
      <div className="rounded-xl border border-white/5 bg-white/5 p-3 text-xs text-white/50">
        <p>
          x402 enables HTTP 402 Payment Required for AI agent commerce. When an
          agent receives a 402 response, it can automatically sign and submit a
          Solana transaction, then retry with the X-PAYMENT header containing
          proof of payment.
        </p>
        <p className="mt-2">
          <a
            href="https://github.com/coinbase/x402"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:underline"
          >
            Learn more about x402 protocol
          </a>
        </p>
      </div>
    </GradientCard>
  );
};
