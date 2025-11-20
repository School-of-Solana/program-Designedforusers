"use client";

import { useCallback, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { GradientCard } from "@/components/ui/gradient-card";
import { Button } from "@/components/ui/button";
import { useWalletPasses } from "@/lib/hooks/use-wallet-passes";
import { useEventFluxProgram } from "@/lib/hooks/use-eventflux-program";

export const PassManager = () => {
  const { data: passes } = useWalletPasses();
  const { program } = useEventFluxProgram();
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string | null>(null);
  const [pendingPass, setPendingPass] = useState<string | null>(null);

  const handleCheckIn = useCallback(
    async (passPk: PublicKey, eventPk: PublicKey) => {
      if (!wallet.connected || !wallet.publicKey || !program) {
        setStatus("Connect your wallet to check in.");
        return;
      }
      setPendingPass(passPk.toBase58());
      setStatus("Submitting check-in...");
      try {
        await program.methods
          .checkIn()
          .accounts({
            verifier: wallet.publicKey,
            event: eventPk,
            eventPass: passPk,
          })
          .rpc();

        await queryClient.invalidateQueries({ queryKey: ["eventflux", "passes", wallet.publicKey.toBase58()] });
        setStatus("Pass checked in!");
      } catch (error) {
        console.error(error);
        setStatus("Check-in failed. Make sure the event is live.");
      } finally {
        setPendingPass(null);
      }
    },
    [wallet.connected, wallet.publicKey, program, queryClient]
  );

  return (
    <GradientCard className="space-y-4">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">My passes</p>
        <h2 className="mt-2 text-xl font-semibold text-white">Manage minted passes & check-in</h2>
        <p className="text-sm text-white/60">
          Any pass minted with your wallet appears here. You can self check-in during the event window (organizers
          and delegated verifiers share the same instruction).
        </p>
      </header>
      <div className="space-y-3">
        {passes?.length ? (
          passes.map(({ publicKey, account }) => (
            <div key={publicKey.toBase58()} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-white font-semibold">Tier #{account.tierId}</p>
                  <p className="text-xs text-white/60">Event: {account.event.toBase58().slice(0, 8)}…</p>
                </div>
                <Button
                  className="bg-white/20 px-4 py-2 text-xs"
                  disabled={account.checkedIn || pendingPass === publicKey.toBase58() || !wallet.connected}
                  onClick={() => handleCheckIn(publicKey, account.event)}
                >
                  {account.checkedIn ? "Checked in" : pendingPass === publicKey.toBase58() ? "Checking..." : "Check in"}
                </Button>
              </div>
              {account.checkedIn && account.checkedInAt && (
                <p className="mt-2 text-[11px] text-emerald-300">
                  Checked in at {new Date(Number(account.checkedInAt) * 1000).toLocaleString()}
                </p>
              )}
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/60">
            Mint an EventFlux pass to see it here.
          </p>
        )}
      </div>
      {status && <p className="text-xs text-white/50">{status}</p>}
    </GradientCard>
  );
};
