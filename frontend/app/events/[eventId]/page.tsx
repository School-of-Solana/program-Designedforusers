"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import BN from "bn.js";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { useEventDetail } from "@/lib/hooks/use-event-detail";
import { useEventFluxProgram } from "@/lib/hooks/use-eventflux-program";
import { getEventPassPda, getVaultTreasuryPda } from "@/lib/pdas";

const formatCountdown = (now: number, start: number, end: number) => {
  if (now >= end) {
    return "Event completed";
  }
  if (now >= start) {
    const remaining = end - now;
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining / (1000 * 60)) % 60);
    return `Live · ${hours}h ${minutes}m remaining`;
  }
  const diff = start - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  return `Starts in ${days}d ${hours}h ${minutes}m`;
};

type AnchorTier = {
  tierId: number;
  label: string;
  priceLamports: BN;
  maxSupply: number;
  sold: number;
};

export default function EventDetailPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const wallet = useWallet();
  const { data, isLoading } = useEventDetail(eventId);
  const { program } = useEventFluxProgram();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<string | null>(null);
  const [pendingTier, setPendingTier] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const handleMint = useCallback(
    async (tierId: number) => {
      if (!wallet.connected || !wallet.publicKey || !program) {
        setStatus("Connect a wallet to mint.");
        return;
      }
      if (!eventId) {
        setStatus("Event not found.");
        return;
      }
      setPendingTier(tierId);
      setStatus("Preparing transaction…");
      try {
        const eventPk = new PublicKey(eventId);
        const eventAccount = await program.account.event.fetch(eventPk);
        const vaultStatePk = new PublicKey(eventAccount.vaultState);
        const vaultTreasury = await getVaultTreasuryPda(eventPk);
        const eventPass = await getEventPassPda(eventPk, wallet.publicKey, tierId);
        await program.methods
          .mintPass(tierId)
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
        setStatus("Pass minted! See it in your dashboard.");
      } catch (error) {
        console.error(error);
        setStatus("Mint failed. Tier may be sold out.");
      } finally {
        setPendingTier(null);
      }
    },
    [wallet.connected, wallet.publicKey, program, eventId, queryClient]
  );

  if (isLoading) {
    return <p className="py-10 text-center text-sm text-white/60">Loading event details…</p>;
  }

  if (!data) {
    return <p className="py-10 text-center text-sm text-white/60">Event not found or requires wallet connection.</p>;
  }

  const { account, vaultState } = data;
  const startTs = Number(account.startTs) * 1000;
  const endTs = Number(account.endTs) * 1000;
  const countdown = formatCountdown(now, startTs, endTs);
  const organizer = (account.organizer as PublicKey).toBase58();
  const verifiers: string[] = account.authorizedVerifiers.map((pk: PublicKey) => pk.toBase58());
  const stats = [
    { label: "Passes Minted", value: Number(account.totalPasses) },
    { label: "Deposited", value: `${(Number(vaultState.totalDeposited) / 1_000_000_000).toFixed(2)} ◎` },
    { label: "Yield Harvested", value: `${(Number(vaultState.totalYieldHarvested) / 1_000_000_000).toFixed(2)} ◎` },
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 py-6">
      <GradientCard className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">Event detail</p>
            <h1 className="text-4xl font-semibold text-white">{account.name}</h1>
            <p className="text-sm text-white/60">{account.venue}</p>
          </div>
          <span className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-wide text-white/70">
            {countdown}
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-white/70">
              <p className="text-xs uppercase tracking-[0.3em]">{stat.label}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{stat.value}</p>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
          <p>Organizer ·{" "}
            <Link href={`/organizers/${organizer}`} className="text-white underline">
              {organizer.slice(0, 4)}…{organizer.slice(-4)}
            </Link>
          </p>
          <p className="mt-1">Yield strategy · {account.yieldStrategy.__kind}</p>
          <p className="mt-1">
            Authorized verifiers · {verifiers.length ? verifiers.map((pk) => `${pk.slice(0, 4)}…${pk.slice(-4)}`).join(", ") : "Organizer only"}
          </p>
        </div>
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">Tiers</p>
          <div className="grid gap-4 md:grid-cols-3">
            {(account.tiers as AnchorTier[]).map((tier) => {
              const available = Number(tier.maxSupply - tier.sold);
              const soldOut = available === 0;
              return (
                <div key={tier.tierId} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                  <p className="text-xs uppercase text-white/60">{tier.label}</p>
                  <p className="mt-1 text-2xl font-semibold text-white">
                    {(Number(tier.priceLamports) / 1_000_000_000).toFixed(2)} ◎
                  </p>
                  <p className="text-xs text-white/50">{available} available</p>
                  <Button
                    className="mt-3 w-full bg-white/15 px-3 py-2 text-xs"
                    disabled={soldOut || pendingTier === tier.tierId || !wallet.connected}
                    onClick={() => handleMint(tier.tierId)}
                  >
                    {!wallet.connected ? "Connect wallet" : soldOut ? "Sold out" : pendingTier === tier.tierId ? "Minting…" : "Mint pass"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
        {status && <p className="text-xs text-white/60">{status}</p>}
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">Vault timeline</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-white/60">
            <li>
              Start time: <span className="text-white">{new Date(startTs).toLocaleString()}</span>
            </li>
            <li>
              End time: <span className="text-white">{new Date(endTs).toLocaleString()}</span>
            </li>
            <li>
              Last harvest:{" "}
              <span className="text-white">
                {vaultState.lastHarvestTs ? new Date(Number(vaultState.lastHarvestTs) * 1000).toLocaleString() : "Not harvested yet"}
              </span>
            </li>
          </ul>
        </div>
      </GradientCard>
    </div>
  );
}
