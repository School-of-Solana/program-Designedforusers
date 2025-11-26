"use client";

import { FormEvent, useMemo, useState } from "react";
import BN from "bn.js";
import { SystemProgram, LAMPORTS_PER_SOL, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { GradientCard } from "@/components/ui/gradient-card";
import { Button } from "@/components/ui/button";
import { useEventFeed } from "@/lib/hooks/use-event-data";
import { useEventFluxProgram } from "@/lib/hooks/use-eventflux-program";
import { getEventPda, getVaultStatePda, getVaultTreasuryPda } from "@/lib/pdas";
import { PublicKey } from "@solana/web3.js";

type CreateEventArgs = {
  eventId: BN;
  name: string;
  venue: string;
  startTs: BN;
  endTs: BN;
  settlementTreasury: PublicKey;
  yieldStrategy: { kamino?: Record<string, never>; sanctum?: Record<string, never>; none?: Record<string, never> };
  authorizedVerifiers: PublicKey[];
  tiers: Array<{
    tierId: number;
    label: string;
    priceLamports: BN;
    maxSupply: number;
  }>;
};

export const OrganizerPanel = () => {
  const wallet = useWallet();
  const { program } = useEventFluxProgram();
  const queryClient = useQueryClient();
  const { data: events } = useEventFeed();
  const [formState, setFormState] = useState({
    name: "EventFlux Labs Live",
    venue: "Breakpoint @ Lisbon",
    supply: 250,
    strategy: "Kamino",
  });
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const tiers = useMemo(
    () => [
      { tierId: 1, label: "General", price: 0.5, maxSupply: Math.ceil(formState.supply * 0.7) },
      { tierId: 2, label: "VIP", price: 1.5, maxSupply: Math.ceil(formState.supply * 0.3) },
    ],
    [formState.supply]
  );

  const onSubmit = async (evt: FormEvent) => {
    evt.preventDefault();
    if (!wallet.connected || !wallet.publicKey || !program) {
      setStatus("Connect a wallet to push the create_event instruction.");
      return;
    }
    setSubmitting(true);
    try {
      const eventId = new BN(Date.now());
      const eventPda = await getEventPda(wallet.publicKey, eventId);
      const vaultState = await getVaultStatePda(eventPda);
      const vaultTreasury = await getVaultTreasuryPda(eventPda);

      const startTs = Math.floor(Date.now() / 1000) + 3600;
      const endTs = startTs + 86_400;

      const args: CreateEventArgs = {
        eventId,
        name: formState.name,
        venue: formState.venue,
        startTs: new BN(startTs),
        endTs: new BN(endTs),
        settlementTreasury: wallet.publicKey,
        yieldStrategy:
          formState.strategy === "Kamino"
            ? { kamino: {} }
            : formState.strategy === "Sanctum"
              ? { sanctum: {} }
              : { none: {} },
        authorizedVerifiers: [wallet.publicKey],
        tiers: tiers.map((tier) => ({
          tierId: tier.tierId,
          label: tier.label,
          priceLamports: new BN(tier.price * LAMPORTS_PER_SOL),
          maxSupply: tier.maxSupply,
        })),
      };

      await program.methods
        .createEvent(args)
        .accounts({
          organizer: wallet.publicKey,
          event: eventPda,
          vaultState,
          vaultTreasury,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      await queryClient.invalidateQueries({ queryKey: ["eventflux"] });
      setStatus("Event created on devnet — passes are accruing yield already.");
    } catch (error) {
      console.error(error);
      setStatus("Failed to send transaction. See console for details.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GradientCard className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-white/60">Organizer cockpit</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Spin up a new on-chain event</h2>
        <p className="text-sm text-white/60">
          Configure tiers, treasury destination, and yield strategy. We’ll derive PDAs + vault state for you
          before dispatching the Anchor instruction.
        </p>
      </header>
      <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
        <label className="text-sm text-white/70">
          Event name
          <input
            className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-base text-white placeholder:text-white/30 focus:outline-none"
            value={formState.name}
            onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
          />
        </label>
        <label className="text-sm text-white/70">
          Venue
          <input
            className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-base text-white placeholder:text-white/30 focus:outline-none"
            value={formState.venue}
            onChange={(e) => setFormState((prev) => ({ ...prev, venue: e.target.value }))}
          />
        </label>
        <label className="text-sm text-white/70">
          Ticket supply
          <input
            type="number"
            min={1}
            className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-base text-white placeholder:text-white/30 focus:outline-none"
            value={formState.supply}
            onChange={(e) => setFormState((prev) => ({ ...prev, supply: Number(e.target.value) }))}
          />
        </label>
        <label className="text-sm text-white/70">
          Yield strategy
          <select
            className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-base text-white focus:outline-none"
            value={formState.strategy}
            onChange={(e) => setFormState((prev) => ({ ...prev, strategy: e.target.value }))}
          >
            <option value="Kamino">Kamino Autopilot</option>
            <option value="Sanctum">Sanctum LS Deposit</option>
            <option value="None">Hold in treasury PDA</option>
          </select>
        </label>
        <div className="md:col-span-2 flex items-center justify-between gap-4">
          <div className="text-sm text-white/60">
            {status ?? "Wallet connection required to broadcast to devnet."}
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Preparing..." : "Prepare create_event"}
          </Button>
        </div>
      </form>
      <div className="rounded-2xl border border-white/5 bg-black/20 p-4 text-sm text-white/70">
        <p className="font-semibold text-white">Live events ({events?.length ?? 0})</p>
        <div className="mt-2 space-y-2">
          {events?.map((event) => (
            <div key={event.publicKey} className="flex items-center justify-between text-xs text-white/70">
              <span>{event.name}</span>
              <span>{new Date(event.start).toLocaleDateString()} · {event.tiers[0]?.label}</span>
            </div>
          ))}
        </div>
      </div>
    </GradientCard>
  );
};
