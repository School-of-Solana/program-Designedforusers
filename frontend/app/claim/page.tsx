"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import BN from "bn.js";
import { useSearchParams } from "next/navigation";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { useEventFluxProgram } from "@/lib/hooks/use-eventflux-program";
import { getEventPassPda, getVaultTreasuryPda } from "@/lib/pdas";

type EventPreview = {
  name: string;
  venue: string;
  start: string;
  tiers: { tierId: number; label: string; price: number; available: number }[];
};

type AnchorTier = {
  tierId: number;
  label: string;
  priceLamports: BN;
  maxSupply: number;
  sold: number;
};

export default function ClaimPage() {
  const searchParams = useSearchParams();
  const eventParam = searchParams.get("event");
  const tierParam = Number(searchParams.get("tier") ?? "1");

  const wallet = useWallet();
  const { program } = useEventFluxProgram();
  const queryClient = useQueryClient();

  const [eventPreview, setEventPreview] = useState<EventPreview | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!program || !eventParam) {
      return;
    }
    let cancelled = false;
    setLoadingEvent(true);
    (async () => {
      try {
        const eventPk = new PublicKey(eventParam);
        const account = await program.account.event.fetch(eventPk);
        if (cancelled) {
          return;
        }
        const tiers = (account.tiers as AnchorTier[]).map((tier) => ({
          tierId: tier.tierId,
          label: tier.label,
          price: Number(tier.priceLamports) / 1_000_000_000,
          available: Number(tier.maxSupply - tier.sold),
        }));
        setEventPreview({
          name: account.name,
          venue: account.venue,
          start: new Date(Number(account.startTs) * 1000).toLocaleString(),
          tiers,
        });
      } catch (error) {
        console.error(error);
        setStatus("Unable to load event — confirm the link is still valid.");
      } finally {
        if (!cancelled) {
          setLoadingEvent(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [program, eventParam]);

  const featuredTier = useMemo(() => {
    if (!eventPreview) {
      return null;
    }
    return eventPreview.tiers.find((tier) => tier.tierId === tierParam) ?? eventPreview.tiers[0] ?? null;
  }, [eventPreview, tierParam]);

  const handleClaim = useCallback(async () => {
    if (!wallet.connected || !wallet.publicKey || !program) {
      setStatus("Connect a wallet to mint your pass.");
      return;
    }
    if (!eventParam || !featuredTier) {
      setStatus("Missing event or tier context.");
      return;
    }
    setPending(true);
    setStatus("Broadcasting mint_pass…");
    try {
      const eventPk = new PublicKey(eventParam);
      const eventAccount = await program.account.event.fetch(eventPk);
      const vaultStatePk = new PublicKey(eventAccount.vaultState);
      const vaultTreasury = await getVaultTreasuryPda(eventPk);
      const eventPass = await getEventPassPda(eventPk, wallet.publicKey, featuredTier.tierId);

      await program.methods
        .mintPass(featuredTier.tierId)
        .accounts({
          attendee: wallet.publicKey,
          event: eventPk,
          vaultState: vaultStatePk,
          vaultTreasury,
          eventPass,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await queryClient.invalidateQueries({ queryKey: ["eventflux"] });
      setStatus("Pass minted! Open the dashboard to self check-in.");
    } catch (error) {
      console.error(error);
      setStatus("Mint failed. Make sure this tier has supply left.");
    } finally {
      setPending(false);
    }
  }, [wallet.connected, wallet.publicKey, program, eventParam, featuredTier, queryClient]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 py-6">
      <GradientCard className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">Guest claim</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Mint your EventFlux pass in one step</h1>
          <p className="text-sm text-white/70">
            Connect a Solana wallet (or mobile wallet via Wallet Adapter). We’ll mint the selected tier and send the
            funds straight into the event’s yield-bearing treasury.
          </p>
        </div>
        {!eventParam ? (
          <p className="rounded-2xl border border-dashed border-white/20 bg-black/20 p-4 text-sm text-white/60">
            Missing event query parameter. Ask the organizer for a fresh link.
          </p>
        ) : loadingEvent ? (
          <p className="text-sm text-white/60">Loading event from devnet…</p>
        ) : eventPreview && featuredTier ? (
          <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/80">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">Event</p>
              <h2 className="text-2xl font-semibold text-white">{eventPreview.name}</h2>
              <p className="text-xs text-white/60">
                {eventPreview.venue} · {eventPreview.start}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase text-white/50">Tier</p>
              <p className="text-lg font-semibold text-white">
                {featuredTier.label} · {featuredTier.price} ◎
              </p>
              <p className="text-xs text-white/60">{featuredTier.available} remaining</p>
            </div>
            <Button
              type="button"
              className="w-full bg-white text-slate-900 px-4 py-2 text-xs font-semibold"
              disabled={pending}
              onClick={handleClaim}
            >
              {pending ? "Minting…" : "Mint my pass"}
            </Button>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-white/20 bg-black/20 p-4 text-sm text-white/60">
            Event data unavailable. Verify the link or ask the organizer to resend.
          </p>
        )}
        {status && <p className="text-xs text-white/60">{status}</p>}
      </GradientCard>
    </div>
  );
}
