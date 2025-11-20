"use client";

import { useMemo, useState } from "react";
import BN from "bn.js";
import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { useOrganizerEvents } from "@/lib/hooks/use-organizer-events";
import { useEventFluxProgram } from "@/lib/hooks/use-eventflux-program";
import {
  getAdapterReservePda,
  getLoyaltyMintPda,
  getVaultTreasuryPda,
} from "@/lib/pdas";
import { adapterProgramId } from "@/lib/env";

const DEFAULT_HARVEST = 0.05 * 1_000_000_000; // 0.05 SOL

export const TreasuryPanel = () => {
  const { data: events } = useOrganizerEvents();
  const { program } = useEventFluxProgram();
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string | null>(null);
  const [loyaltyTarget, setLoyaltyTarget] = useState<string>("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const sortedEvents = useMemo(() => events?.sort((a, b) => Number(b.account.startTs) - Number(a.account.startTs)) ?? [], [events]);

  const handleWithdraw = async (eventPk: PublicKey, vaultStatePk: PublicKey) => {
    if (!program || !wallet.publicKey) {
      setStatus("Connect your organizer wallet to withdraw.");
      return;
    }
    setPendingAction(eventPk.toBase58());
    setStatus("Withdrawing treasury...");
    try {
      const vaultTreasury = await getVaultTreasuryPda(eventPk);
      await program.methods
        .withdrawTreasury()
        .accounts({
          organizer: wallet.publicKey,
          event: eventPk,
          vaultState: vaultStatePk,
          destination: wallet.publicKey,
          vaultTreasury,
        })
        .rpc();

      await queryClient.invalidateQueries({ queryKey: ["eventflux"] });
      setStatus("Funds withdrawn to your settlement treasury.");
    } catch (error) {
      console.error(error);
      setStatus("Withdrawal failed. Ensure the event has ended.");
    } finally {
      setPendingAction(null);
    }
  };

  const handleHarvest = async (eventPk: PublicKey, vaultStatePk: PublicKey) => {
    if (!program || !wallet.publicKey) {
      setStatus("Connect your organizer wallet to harvest.");
      return;
    }
    setPendingAction(`harvest-${eventPk.toBase58()}`);
    setStatus("Harvesting yield via adapter CPI...");
    try {
      const vaultTreasury = await getVaultTreasuryPda(eventPk);
      const adapterReserve = await getAdapterReservePda(adapterProgramId);
      await program.methods
        .harvestYield(new BN(DEFAULT_HARVEST))
        .accounts({
          organizer: wallet.publicKey,
          event: eventPk,
          vaultState: vaultStatePk,
          vaultTreasury,
          adapterReserve,
          vaultAdapterProgram: adapterProgramId,
        })
        .rpc();

      setStatus("Harvest instruction sent — treasury balance updated.");
    } catch (error) {
      console.error(error);
      setStatus("Harvest failed (fund adapter reserve first).");
    } finally {
      setPendingAction(null);
    }
  };

  const handleLoyalty = async () => {
    if (!program || !wallet.publicKey || !loyaltyTarget) {
      setStatus("Enter a pass PDA and connect your organizer wallet.");
      return;
    }
    setPendingAction("loyalty");
    setStatus("Issuing loyalty NFT...");
    try {
      const passPk = new PublicKey(loyaltyTarget.trim());
      const passAccount = await program.account.eventPass.fetch(passPk);
      const eventAccount = await program.account.event.fetch(passAccount.event);
      if (!eventAccount.organizer.equals(wallet.publicKey)) {
        throw new Error("Only the event organizer can issue loyalty NFTs.");
      }
      const loyaltyMint = await getLoyaltyMintPda(passPk);
      const ata = await getAssociatedTokenAddress(loyaltyMint, passAccount.owner, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

      await program.methods
        .issueLoyaltyNft()
        .accounts({
          organizer: wallet.publicKey,
          event: passAccount.event,
          eventPass: passPk,
          passOwner: passAccount.owner,
          loyaltyMint,
          loyaltyTokenAccount: ata,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      setStatus("Loyalty NFT minted to attendee.");
    } catch (error) {
      console.error(error);
      setStatus("Failed to mint loyalty NFT. Verify pass PDA.");
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <GradientCard className="space-y-5">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Treasury controls</p>
        <h2 className="mt-2 text-xl font-semibold text-white">Harvest yield · settle funds · drop perks</h2>
        <p className="text-sm text-white/60">
          Visible only to wallets that created events. Harvest taps the vault adapter CPI (ensure its reserve has lamports), withdraw returns principal + yield, and loyalty drop mints POAP-style SPL tokens.
        </p>
      </header>
      <div className="space-y-3">
        {sortedEvents.length ? (
          sortedEvents.map(({ publicKey, account }) => {
            const eventPk = publicKey as PublicKey;
            const vaultStatePk = new PublicKey(account.vaultState);
            return (
            <div key={publicKey.toBase58()} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{account.name}</p>
                  <p className="text-xs text-white/60">Vault: {account.vaultState.toBase58().slice(0, 6)}…</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="bg-white/15 px-3 py-1 text-xs"
                    disabled={!wallet.connected || pendingAction === `harvest-${publicKey.toBase58()}`}
                    onClick={() => handleHarvest(eventPk, vaultStatePk)}
                  >
                    {pendingAction === `harvest-${publicKey.toBase58()}` ? "Harvesting..." : "Harvest"}
                  </Button>
                  <Button
                    className="bg-emerald-400/20 px-3 py-1 text-xs"
                    disabled={!wallet.connected || pendingAction === publicKey.toBase58()}
                    onClick={() => handleWithdraw(eventPk, vaultStatePk)}
                  >
                    {pendingAction === publicKey.toBase58() ? "Withdrawing..." : "Withdraw"}
                  </Button>
                </div>
              </div>
            </div>
            );
          })
        ) : (
          <p className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/60">
            Deploy an event via the organizer cockpit to unlock treasury controls.
          </p>
        )}
      </div>
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Loyalty drop</p>
        <p className="mt-1 text-white">Paste an EventPass PDA to mint its 0-decimal perk NFT.</p>
        <div className="mt-3 flex flex-col gap-3 md:flex-row">
          <input
            placeholder="EventPass PDA"
            className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-white placeholder:text-white/30 focus:outline-none"
            value={loyaltyTarget}
            onChange={(e) => setLoyaltyTarget(e.target.value)}
          />
          <Button
            type="button"
            className="bg-white text-slate-900 px-4 py-2 text-xs"
            disabled={!wallet.connected || !loyaltyTarget || pendingAction === "loyalty"}
            onClick={handleLoyalty}
          >
            {pendingAction === "loyalty" ? "Minting..." : "Issue loyalty"}
          </Button>
        </div>
      </div>
      {status && <p className="text-xs text-white/60">{status}</p>}
    </GradientCard>
  );
};
