"use client";

import { useCallback, useMemo, useState } from "react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { useEventFeed } from "@/lib/hooks/use-event-data";
import { useEventFluxProgram } from "@/lib/hooks/use-eventflux-program";
import { getEventPassPda, getVaultTreasuryPda } from "@/lib/pdas";

export const AttendeePanel = () => {
  const { data: events } = useEventFeed();
  const wallet = useWallet();
  const { program } = useEventFluxProgram();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string | null>(null);
  const [isMinting, setIsMinting] = useState(false);

  const featured = useMemo(() => events?.slice(0, 3) ?? [], [events]);

  const handleMint = useCallback(
    async (eventAddress: string, tierId: number) => {
      if (!wallet.connected || !wallet.publicKey || !program) {
        setStatus("Connect wallet to mint passes.");
        return;
      }
      setIsMinting(true);
      setStatus("Sending transaction to mint pass...");
      try {
        const eventPk = new PublicKey(eventAddress);
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
        setStatus("Pass minted! Check the loyalty tab after check-in.");
      } catch (error) {
        console.error(error);
        setStatus("Failed to mint pass. See console for details.");
      } finally {
        setIsMinting(false);
      }
    },
    [wallet.connected, wallet.publicKey, program, queryClient]
  );

  return (
    <GradientCard className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-white/60">Attendee view</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Claim, check-in, and redeem perks</h2>
        <p className="text-sm text-white/60">
          Connect any Solana wallet to mint tiered passes, scan Solana Pay check-in codes, and keep loyalty NFTs
          synced across events.
        </p>
      </header>
      <div className="space-y-4">
        {featured.map((event) => (
          <div key={event.publicKey} className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-white">{event.name}</p>
                <p className="text-xs uppercase tracking-wide text-white/40">{event.venue}</p>
              </div>
              <Button
                className="bg-white text-slate-900 px-4 py-2 text-xs font-semibold"
                disabled={!wallet.connected || !program || isMinting || !event.tiers.length}
                onClick={() => handleMint(event.publicKey, event.tiers[0]?.tierId ?? 1)}
              >
                {wallet.connected ? (isMinting ? "Minting..." : "Mint pass") : "Connect to mint"}
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-white/60">
              <span>
                {new Date(event.start).toLocaleDateString()} → {new Date(event.end).toLocaleDateString()}
              </span>
              <span>{event.strategy}</span>
            </div>
            <div className="mt-3 grid gap-2 text-sm text-white/80 md:grid-cols-3">
              {event.tiers.map((tier, index) => (
                <div key={tier.tier} className="rounded-xl border border-white/5 bg-white/5 px-3 py-2">
                  <p className="text-xs uppercase text-white/50">{tier.tier}</p>
                  <p className="text-base font-semibold">{tier.price} ◎</p>
                  <p className="text-xs text-white/50">{tier.available} left</p>
                  <Button
                    type="button"
                    className="mt-2 w-full bg-white/20 px-3 py-1 text-[11px]"
                    disabled={!wallet.connected || !program || isMinting}
                    onClick={() => handleMint(event.publicKey, tier.tierId ?? index + 1)}
                  >
                    {wallet.connected ? "Mint" : "Connect"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {status && <p className="text-xs text-white/60">{status}</p>}
    </GradientCard>
  );
};
