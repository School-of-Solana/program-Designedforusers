/**
 * x402-Protected Events API
 *
 * Returns list of all events with analytics data.
 * Requires x402 payment for access - ideal for AI agents and data aggregators.
 *
 * GET /api/x402/events
 *
 * Headers:
 *   X-PAYMENT: Base64 encoded payment proof (required)
 *
 * Response (200):
 *   {
 *     events: Array<{
 *       publicKey: string,
 *       name: string,
 *       venue: string,
 *       organizer: string,
 *       startTs: number,
 *       endTs: number,
 *       totalPasses: number,
 *       tiers: Array<{ label: string, price: number, sold: number, maxSupply: number }>,
 *       yieldStrategy: string,
 *       settled: boolean,
 *       vaultStats: { deposited: number, withdrawn: number, yieldHarvested: number }
 *     }>
 *   }
 *
 * Response (402):
 *   Payment required response with SOL payment details
 */

import { NextRequest } from "next/server";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { withX402Payment, EVENTFLUX_PRICING, create402Response } from "@/lib/x402";
import { x402Config, x402Enabled } from "../config";
import { rpcEndpoint, eventFluxIdl } from "@/lib/env";

// Type for Anchor account data
interface AnchorTier {
  tierId: number;
  label: string;
  priceLamports: { toNumber(): number };
  maxSupply: number;
  sold: number;
}

interface AnchorYieldStrategy {
  kamino?: Record<string, never>;
  sanctum?: Record<string, never>;
  none?: Record<string, never>;
}

interface EventAccount {
  bump: number;
  eventId: { toNumber(): number };
  organizer: PublicKey;
  settlementTreasury: PublicKey;
  name: string;
  venue: string;
  startTs: { toNumber(): number };
  endTs: { toNumber(): number };
  yieldStrategy: AnchorYieldStrategy;
  tiers: AnchorTier[];
  authorizedVerifiers: PublicKey[];
  totalPasses: { toNumber(): number };
  vaultState: PublicKey;
  settled: boolean;
}

interface VaultStateAccount {
  bump: number;
  event: PublicKey;
  strategy: AnchorYieldStrategy;
  totalDeposited: { toNumber(): number };
  totalWithdrawn: { toNumber(): number };
  totalYieldHarvested: { toNumber(): number };
  vaultTreasuryBump: number;
  lastHarvestTs: { toNumber(): number };
}

function getYieldStrategyName(strategy: AnchorYieldStrategy): string {
  if (strategy.kamino) return "Kamino";
  if (strategy.sanctum) return "Sanctum";
  return "None";
}

async function fetchAllEvents() {
  const connection = new Connection(rpcEndpoint, "confirmed");

  // Create a read-only provider
  const provider = new AnchorProvider(
    connection,
    {
      publicKey: PublicKey.default,
      signTransaction: async () => {
        throw new Error("Read-only");
      },
      signAllTransactions: async () => {
        throw new Error("Read-only");
      },
    },
    { commitment: "confirmed" }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const program: any = new Program(eventFluxIdl as any, provider);

  // Fetch all events
  const eventAccounts = await program.account.event.all();

  // Fetch vault states for each event
  const events = await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    eventAccounts.map(async (eventAccount: any) => {
      const event = eventAccount.account as unknown as EventAccount;

      let vaultStats = {
        deposited: 0,
        withdrawn: 0,
        yieldHarvested: 0,
      };

      try {
        const vaultState = (await program.account.vaultState.fetch(
          event.vaultState
        )) as unknown as VaultStateAccount;

        vaultStats = {
          deposited: vaultState.totalDeposited.toNumber() / LAMPORTS_PER_SOL,
          withdrawn: vaultState.totalWithdrawn.toNumber() / LAMPORTS_PER_SOL,
          yieldHarvested: vaultState.totalYieldHarvested.toNumber() / LAMPORTS_PER_SOL,
        };
      } catch {
        // Vault state may not exist yet
      }

      return {
        publicKey: eventAccount.publicKey.toBase58(),
        name: event.name,
        venue: event.venue,
        organizer: event.organizer.toBase58(),
        startTs: event.startTs.toNumber(),
        endTs: event.endTs.toNumber(),
        totalPasses: event.totalPasses.toNumber(),
        tiers: event.tiers.map((tier) => ({
          label: tier.label,
          price: tier.priceLamports.toNumber() / LAMPORTS_PER_SOL,
          sold: tier.sold,
          maxSupply: tier.maxSupply,
        })),
        yieldStrategy: getYieldStrategyName(event.yieldStrategy),
        settled: event.settled,
        vaultStats,
      };
    })
  );

  return events;
}

export async function GET(request: NextRequest) {
  // If x402 disabled, return events directly
  if (!x402Enabled) {
    try {
      const events = await fetchAllEvents();
      return Response.json({ events, x402: false });
    } catch (error) {
      console.error("Error fetching events:", error);
      return Response.json({ error: "Failed to fetch events" }, { status: 500 });
    }
  }

  // x402 protected endpoint
  return withX402Payment(
    request,
    x402Config,
    EVENTFLUX_PRICING.eventListing(),
    async (payer) => {
      try {
        const events = await fetchAllEvents();
        return Response.json({
          events,
          x402: true,
          payer,
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error("Error fetching events:", error);
        return Response.json({ error: "Failed to fetch events" }, { status: 500 });
      }
    }
  );
}

// Return 402 requirements on OPTIONS/HEAD
export async function HEAD(request: NextRequest) {
  if (!x402Enabled) {
    return new Response(null, { status: 200 });
  }
  return create402Response(x402Config, EVENTFLUX_PRICING.eventListing());
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-PAYMENT",
      "Access-Control-Expose-Headers": "X-PAYMENT-RESPONSE",
    },
  });
}
