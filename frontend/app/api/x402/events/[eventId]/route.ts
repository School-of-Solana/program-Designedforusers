/**
 * x402-Protected Single Event API
 *
 * Returns detailed data for a specific event including pass holders.
 * Requires x402 payment for access.
 *
 * GET /api/x402/events/[eventId]
 *
 * Headers:
 *   X-PAYMENT: Base64 encoded payment proof (required)
 *
 * Response (200):
 *   {
 *     event: { ... },
 *     passes: Array<{ owner: string, tier: string, checkedIn: boolean, ... }>,
 *     analytics: { revenue: number, checkInRate: number, ... }
 *   }
 */

import { NextRequest } from "next/server";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { withX402Payment, EVENTFLUX_PRICING, create402Response } from "@/lib/x402";
import { x402Config, x402Enabled } from "../../config";
import { rpcEndpoint, eventFluxIdl } from "@/lib/env";

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

interface EventPassAccount {
  bump: number;
  event: PublicKey;
  owner: PublicKey;
  tierId: number;
  pricePaid: { toNumber(): number };
  mintedAt: { toNumber(): number };
  checkedIn: boolean;
  checkedInAt: { toNumber(): number } | null;
  loyaltyMint: PublicKey | null;
}

interface VaultStateAccount {
  totalDeposited: { toNumber(): number };
  totalWithdrawn: { toNumber(): number };
  totalYieldHarvested: { toNumber(): number };
}

interface PassResult {
  publicKey: string;
  owner: string;
  tierLabel: string;
  tierId: number;
  pricePaid: number;
  mintedAt: number;
  checkedIn: boolean;
  checkedInAt: number | null;
  hasLoyaltyNft: boolean;
}

function getYieldStrategyName(strategy: AnchorYieldStrategy): string {
  if (strategy.kamino) return "Kamino";
  if (strategy.sanctum) return "Sanctum";
  return "None";
}

async function fetchEventDetails(eventId: string) {
  const connection = new Connection(rpcEndpoint, "confirmed");

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

  // Parse event public key
  let eventPk: PublicKey;
  try {
    eventPk = new PublicKey(eventId);
  } catch {
    throw new Error("Invalid event ID format");
  }

  // Fetch event
  const eventAccount = (await program.account.event.fetch(
    eventPk
  )) as unknown as EventAccount;

  // Fetch vault state
  let vaultStats = {
    deposited: 0,
    withdrawn: 0,
    yieldHarvested: 0,
  };

  try {
    const vaultState = (await program.account.vaultState.fetch(
      eventAccount.vaultState
    )) as unknown as VaultStateAccount;

    vaultStats = {
      deposited: vaultState.totalDeposited.toNumber() / LAMPORTS_PER_SOL,
      withdrawn: vaultState.totalWithdrawn.toNumber() / LAMPORTS_PER_SOL,
      yieldHarvested: vaultState.totalYieldHarvested.toNumber() / LAMPORTS_PER_SOL,
    };
  } catch {
    // Vault state may not exist
  }

  // Fetch all passes for this event using memcmp filter
  const EVENT_PASS_DISCRIMINATOR_SIZE = 8;
  const BUMP_SIZE = 1;

  const passAccounts = await program.account.eventPass.all([
    {
      memcmp: {
        offset: EVENT_PASS_DISCRIMINATOR_SIZE + BUMP_SIZE,
        bytes: eventPk.toBase58(),
      },
    },
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const passes: PassResult[] = passAccounts.map((passAccount: any) => {
    const pass = passAccount.account as unknown as EventPassAccount;
    const tier = eventAccount.tiers.find((t: AnchorTier) => t.tierId === pass.tierId);

    return {
      publicKey: passAccount.publicKey.toBase58(),
      owner: pass.owner.toBase58(),
      tierLabel: tier?.label ?? `Tier ${pass.tierId}`,
      tierId: pass.tierId,
      pricePaid: pass.pricePaid.toNumber() / LAMPORTS_PER_SOL,
      mintedAt: pass.mintedAt.toNumber(),
      checkedIn: pass.checkedIn,
      checkedInAt: pass.checkedInAt?.toNumber() ?? null,
      hasLoyaltyNft: pass.loyaltyMint !== null,
    };
  });

  // Calculate analytics
  const checkedInCount = passes.filter((p) => p.checkedIn).length;
  const totalRevenue = passes.reduce((sum, p) => sum + p.pricePaid, 0);

  const analytics = {
    totalPasses: passes.length,
    checkedInCount,
    checkInRate: passes.length > 0 ? (checkedInCount / passes.length) * 100 : 0,
    totalRevenue,
    averageTicketPrice: passes.length > 0 ? totalRevenue / passes.length : 0,
    loyaltyNftsIssued: passes.filter((p) => p.hasLoyaltyNft).length,
    tierBreakdown: eventAccount.tiers.map((tier) => ({
      label: tier.label,
      sold: tier.sold,
      maxSupply: tier.maxSupply,
      revenue: (tier.sold * tier.priceLamports.toNumber()) / LAMPORTS_PER_SOL,
      utilization: tier.maxSupply > 0 ? (tier.sold / tier.maxSupply) * 100 : 0,
    })),
  };

  return {
    event: {
      publicKey: eventPk.toBase58(),
      name: eventAccount.name,
      venue: eventAccount.venue,
      organizer: eventAccount.organizer.toBase58(),
      settlementTreasury: eventAccount.settlementTreasury.toBase58(),
      startTs: eventAccount.startTs.toNumber(),
      endTs: eventAccount.endTs.toNumber(),
      yieldStrategy: getYieldStrategyName(eventAccount.yieldStrategy),
      settled: eventAccount.settled,
      authorizedVerifiers: eventAccount.authorizedVerifiers.map((v) =>
        v.toBase58()
      ),
      tiers: eventAccount.tiers.map((tier) => ({
        tierId: tier.tierId,
        label: tier.label,
        price: tier.priceLamports.toNumber() / LAMPORTS_PER_SOL,
        sold: tier.sold,
        maxSupply: tier.maxSupply,
      })),
      vaultStats,
    },
    passes,
    analytics,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;

  // If x402 disabled, return data directly
  if (!x402Enabled) {
    try {
      const data = await fetchEventDetails(eventId);
      return Response.json({ ...data, x402: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return Response.json({ error: message }, { status: 400 });
    }
  }

  // x402 protected endpoint
  return withX402Payment(
    request,
    x402Config,
    EVENTFLUX_PRICING.eventData(eventId),
    async (payer) => {
      try {
        const data = await fetchEventDetails(eventId);
        return Response.json({
          ...data,
          x402: true,
          payer,
          timestamp: Date.now(),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return Response.json({ error: message }, { status: 400 });
      }
    }
  );
}

export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;

  if (!x402Enabled) {
    return new Response(null, { status: 200 });
  }
  return create402Response(x402Config, EVENTFLUX_PRICING.eventData(eventId));
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
