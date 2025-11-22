"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import BN from "bn.js";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
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

type WithdrawContext = {
  eventPk: PublicKey;
  vaultStatePk: PublicKey;
  vaultTreasury: PublicKey;
  eventName: string;
  amountLamports: number;
};

type LoyaltyCandidate = {
  publicKey: PublicKey;
  owner: PublicKey;
  event: PublicKey;
  checkedInAt: number | null;
};

export const TreasuryPanel = () => {
  const { data: events } = useOrganizerEvents();
  const { program } = useEventFluxProgram();
  const wallet = useWallet();
  const { connection } = useConnection();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [adapterReserveInfo, setAdapterReserveInfo] = useState<{ address: PublicKey; balance: number } | null>(null);
  const [withdrawContext, setWithdrawContext] = useState<WithdrawContext | null>(null);
  const [loyaltyModalEvent, setLoyaltyModalEvent] = useState<{ eventPk: PublicKey; eventName: string } | null>(null);
  const [loyaltyPasses, setLoyaltyPasses] = useState<LoyaltyCandidate[]>([]);
  const [rewardSelection, setRewardSelection] = useState<Set<string>>(new Set());
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const [loyaltyStatus, setLoyaltyStatus] = useState<string | null>(null);
  const [mintPreview, setMintPreview] = useState<{ name: string; image: string; count: number } | null>(null);

  const sortedEvents = useMemo(
    () => events?.sort((a, b) => Number(b.account.startTs) - Number(a.account.startTs)) ?? [],
    [events]
  );

  const refreshAdapterReserve = useCallback(async () => {
    const address = adapterReserveInfo?.address ?? (await getAdapterReservePda(adapterProgramId));
    const balance = await connection.getBalance(address);
    setAdapterReserveInfo({ address, balance });
    return { address, balance };
  }, [adapterReserveInfo?.address, connection]);

  useEffect(() => {
    refreshAdapterReserve().catch((error) => console.error("Failed to load adapter reserve", error));
  }, [refreshAdapterReserve]);

  const prepareWithdraw = useCallback(
    async (eventPk: PublicKey, vaultStatePk: PublicKey, eventName: string) => {
      if (!program || !wallet.publicKey) {
        setStatus("Connect your organizer wallet to withdraw.");
        return;
      }
      setPendingAction(`preview-${eventPk.toBase58()}`);
      try {
        const vaultTreasury = await getVaultTreasuryPda(eventPk);
        const amountLamports = await connection.getBalance(vaultTreasury);
        setWithdrawContext({
          eventPk,
          vaultStatePk,
          vaultTreasury,
          eventName,
          amountLamports,
        });
      } catch (error) {
        console.error(error);
        setStatus("Unable to read treasury balance. Try again.");
      } finally {
        setPendingAction(null);
      }
    },
    [program, wallet.publicKey, connection]
  );

  const executeWithdraw = useCallback(async () => {
    if (!withdrawContext || !program || !wallet.publicKey) {
      setStatus("Connect your organizer wallet first.");
      return;
    }
    setPendingAction(withdrawContext.eventPk.toBase58());
    setStatus("Withdrawing treasury...");
    try {
      await program.methods
        .withdrawTreasury()
        .accounts({
          organizer: wallet.publicKey,
          event: withdrawContext.eventPk,
          vaultState: withdrawContext.vaultStatePk,
          destination: wallet.publicKey,
          vaultTreasury: withdrawContext.vaultTreasury,
        })
        .rpc();

      await queryClient.invalidateQueries({ queryKey: ["eventflux"] });
      setStatus("Funds withdrawn to your settlement treasury.");
    } catch (error) {
      console.error(error);
      setStatus("Withdrawal failed. Ensure the event has ended.");
    } finally {
      setPendingAction(null);
      setWithdrawContext(null);
    }
  }, [withdrawContext, program, wallet.publicKey, queryClient]);

  const handleHarvest = useCallback(
    async (eventPk: PublicKey, vaultStatePk: PublicKey, strategyKind: string) => {
      if (!program || !wallet.publicKey) {
        setStatus("Connect your organizer wallet to harvest.");
        return;
      }
      if (strategyKind === "None") {
        setStatus("This event keeps funds idle — no harvest available.");
        return;
      }
      const actionKey = `harvest-${eventPk.toBase58()}`;
      setPendingAction(actionKey);
      setStatus("Harvesting yield via adapter CPI...");
      try {
        const vaultTreasury = await getVaultTreasuryPda(eventPk);
        const { address, balance } = await refreshAdapterReserve();
        const harvestLamports = Math.min(balance, DEFAULT_HARVEST);
        if (harvestLamports <= 0) {
          setStatus("Adapter reserve empty — fund it before harvesting.");
          return;
        }
        await program.methods
          .harvestYield(new BN(harvestLamports))
          .accounts({
            organizer: wallet.publicKey,
            event: eventPk,
            vaultState: vaultStatePk,
            vaultTreasury,
            adapterReserve: address,
            vaultAdapterProgram: adapterProgramId,
          })
          .rpc();

        await queryClient.invalidateQueries({ queryKey: ["eventflux"] });
        setStatus(`Harvested ${(harvestLamports / LAMPORTS_PER_SOL).toFixed(3)} ◎ into the treasury.`);
        await refreshAdapterReserve();
      } catch (error) {
        console.error(error);
        setStatus("Harvest failed (fund adapter reserve first).");
      } finally {
        setPendingAction(null);
      }
    },
    [program, wallet.publicKey, refreshAdapterReserve, queryClient]
  );

  const openRewardModal = useCallback(
    async (eventPk: PublicKey, eventName: string) => {
      if (!program || !wallet.publicKey) {
        setStatus("Connect your organizer wallet to reward attendees.");
        return;
      }
      setLoyaltyModalEvent({ eventPk, eventName });
      setLoyaltyLoading(true);
      setLoyaltyStatus("Loading checked-in passes…");
      try {
        const filters = [
          {
            memcmp: {
              offset: 8 + 1, // disc + bump
              bytes: eventPk.toBase58(),
            },
          },
        ];
        const fetched = await program.account.eventPass.all(filters);
        const eligible = fetched
          .filter(({ account }) => account.checkedIn && !account.loyaltyMint)
          .map(({ publicKey, account }) => ({
            publicKey,
            owner: account.owner as PublicKey,
            event: account.event as PublicKey,
            checkedInAt: account.checkedInAt ? Number(account.checkedInAt) : null,
          }));

        setLoyaltyPasses(eligible);
        setRewardSelection(new Set(eligible.map((pass) => pass.publicKey.toBase58())));
        setLoyaltyStatus(
          eligible.length
            ? "Select attendees to airdrop POAPs."
            : "Everyone either skipped check-in or already claimed their NFT."
        );
      } catch (error) {
        console.error(error);
        setLoyaltyStatus("Unable to load passes for this event.");
      } finally {
        setLoyaltyLoading(false);
      }
    },
    [program, wallet.publicKey]
  );

  const closeRewardModal = useCallback(() => {
    setLoyaltyModalEvent(null);
    setLoyaltyPasses([]);
    setRewardSelection(new Set());
    setLoyaltyStatus(null);
  }, []);

  const toggleRewardSelection = (passPk: string, checked: boolean) => {
    setRewardSelection((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(passPk);
      } else {
        next.delete(passPk);
      }
      return next;
    });
  };

  const toggleSelectAllRewards = (checked: boolean) => {
    setRewardSelection(checked ? new Set(loyaltyPasses.map((pass) => pass.publicKey.toBase58())) : new Set());
  };

  const issueSelectedRewards = useCallback(async () => {
    if (!loyaltyModalEvent || !program || !wallet.publicKey) {
      setStatus("Connect your organizer wallet first.");
      return;
    }
    const targets = loyaltyPasses.filter((pass) => rewardSelection.has(pass.publicKey.toBase58()));
    if (!targets.length) {
      setLoyaltyStatus("Select at least one attendee.");
      return;
    }
    setPendingAction("loyalty-bulk");
    setLoyaltyStatus("Minting loyalty NFTs…");
    try {
      await Promise.all(
        targets.map(async (pass) => {
          const loyaltyMint = await getLoyaltyMintPda(pass.publicKey);
          const ata = await getAssociatedTokenAddress(
            loyaltyMint,
            pass.owner,
            false,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          );

          await program.methods
            .issueLoyaltyNft()
            .accounts({
              organizer: wallet.publicKey,
              event: loyaltyModalEvent.eventPk,
              eventPass: pass.publicKey,
              passOwner: pass.owner,
              loyaltyMint,
              loyaltyTokenAccount: ata,
              tokenProgram: TOKEN_PROGRAM_ID,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
              rent: SYSVAR_RENT_PUBKEY,
            })
            .rpc();
        })
      );

      await queryClient.invalidateQueries({ queryKey: ["eventflux"] });
      setStatus(`Minted ${targets.length} loyalty NFTs.`);
      setMintPreview({
        name: `${loyaltyModalEvent.eventName} POAP`,
        image: "/file.svg",
        count: targets.length,
      });
      closeRewardModal();
    } catch (error) {
      console.error(error);
      setLoyaltyStatus("Failed to mint loyalty NFTs. Try again.");
    } finally {
      setPendingAction(null);
    }
  }, [loyaltyModalEvent, loyaltyPasses, rewardSelection, program, wallet.publicKey, queryClient, closeRewardModal]);

  const harvestEstimateSol = useMemo(() => {
    if (!adapterReserveInfo) {
      return null;
    }
    const lamports = Math.min(adapterReserveInfo.balance, DEFAULT_HARVEST);
    return lamports / LAMPORTS_PER_SOL;
  }, [adapterReserveInfo]);

  return (
    <GradientCard className="space-y-5">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Treasury controls</p>
        <h2 className="mt-2 text-xl font-semibold text-white">Harvest yield · settle funds · drop perks</h2>
        <p className="text-sm text-white/60">
          Visible only to wallets that created events. Harvest taps the vault adapter CPI, withdraw drains the vault
          post-event, and “Reward attendees” mints POAP-style loyalty NFTs in bulk.
        </p>
      </header>
      <div className="space-y-3">
        {sortedEvents.length ? (
          sortedEvents.map(({ publicKey, account }) => {
            const eventPk = publicKey as PublicKey;
            const vaultStatePk = new PublicKey(account.vaultState);
            const strategyKind = account.yieldStrategy.__kind ?? "None";
            const sold = account.tiers.reduce((sum, tier) => sum + Number(tier.sold ?? 0), 0);
            const maxSupply = account.tiers.reduce((sum, tier) => sum + Number(tier.maxSupply ?? 0), 0);

            return (
              <div
                key={publicKey.toBase58()}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{account.name}</p>
                    <p className="text-xs text-white/60">
                      Vault {account.vaultState.toBase58().slice(0, 6)}… · {sold}/{maxSupply || "∞"} passes sold
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {strategyKind !== "None" && (
                      <Button
                        className="bg-white/15 px-3 py-1 text-xs"
                        disabled={!wallet.connected || pendingAction === `harvest-${publicKey.toBase58()}`}
                        onClick={() => handleHarvest(eventPk, vaultStatePk, strategyKind)}
                      >
                        {pendingAction === `harvest-${publicKey.toBase58()}` ? "Harvesting..." : "Harvest now"}
                      </Button>
                    )}
                    <Button
                      className="bg-emerald-400/20 px-3 py-1 text-xs"
                      disabled={!wallet.connected || pendingAction === `preview-${publicKey.toBase58()}`}
                      onClick={() => prepareWithdraw(eventPk, vaultStatePk, account.name)}
                    >
                      {pendingAction === `preview-${publicKey.toBase58()}` ? "Preparing..." : "Settle & Withdraw"}
                    </Button>
                    <Button
                      className="bg-white/15 px-3 py-1 text-xs"
                      disabled={!wallet.connected || pendingAction === "loyalty-bulk"}
                      onClick={() => openRewardModal(eventPk, account.name)}
                    >
                      Reward attendees
                    </Button>
                  </div>
                </div>
                {strategyKind !== "None" && harvestEstimateSol !== null && (
                  <p className="mt-2 text-[11px] text-white/50">
                    Est. harvest {harvestEstimateSol.toFixed(3)} ◎ ready in adapter reserve.
                  </p>
                )}
              </div>
            );
          })
        ) : (
          <p className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/60">
            Deploy an event via the organizer cockpit to unlock treasury controls.
          </p>
        )}
      </div>
      {mintPreview && (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/80">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">Latest loyalty drop</p>
          <div className="mt-3 flex items-center gap-4">
            <div className="h-16 w-16 overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-emerald-400/60 to-cyan-500/30 p-3">
              <Image src={mintPreview.image} alt="POAP art" width={48} height={48} className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="text-base font-semibold text-white">{mintPreview.name}</p>
              <p className="text-xs text-white/50">{mintPreview.count} NFTs minted across attendees.</p>
            </div>
          </div>
        </div>
      )}
      {status && <p className="text-xs text-white/60">{status}</p>}

      {withdrawContext && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#080716] p-6 shadow-2xl">
            <h3 className="text-xl font-semibold text-white">Settle & withdraw?</h3>
            <p className="mt-2 text-sm text-white/70">
              You’re about to drain the vault for <span className="font-semibold text-white">{withdrawContext.eventName}</span>.
            </p>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/80">
              <p>Projected SOL</p>
              <p className="text-2xl font-semibold text-white">
                {(withdrawContext.amountLamports / LAMPORTS_PER_SOL).toFixed(3)} ◎
              </p>
              <p className="text-xs text-white/50">
                Includes ticket principal + harvested yield. Event must be past its end timestamp.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button className="bg-white/10 px-4 py-2 text-xs" onClick={() => setWithdrawContext(null)}>
                Cancel
              </Button>
              <Button
                className="bg-emerald-400/70 px-4 py-2 text-xs text-slate-900"
                onClick={executeWithdraw}
                disabled={pendingAction === withdrawContext.eventPk.toBase58()}
              >
                {pendingAction === withdrawContext.eventPk.toBase58() ? "Withdrawing..." : "Confirm withdraw"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {loyaltyModalEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#080716] p-6 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">Reward attendees</p>
                <h3 className="text-xl font-semibold text-white">{loyaltyModalEvent.eventName}</h3>
              </div>
              <Button className="bg-white/10 px-3 py-1 text-xs" onClick={closeRewardModal}>
                Close
              </Button>
            </div>
            <p className="mt-2 text-sm text-white/70">
              Select the checked-in passes you want to reward. Each mint is a 0-decimal SPL token that wallets recognize
              instantly.
            </p>
            <div className="mt-4 max-h-[320px] space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-4">
              {loyaltyLoading ? (
                <p className="text-xs text-white/60">Loading passes…</p>
              ) : loyaltyPasses.length ? (
                loyaltyPasses.map((pass) => {
                  const passKey = pass.publicKey.toBase58();
                  return (
                    <div
                      key={passKey}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/70"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">Pass {passKey.slice(0, 6)}…</p>
                        <p>
                          Owner {pass.owner.toBase58().slice(0, 4)}…{pass.owner.toBase58().slice(-4)}
                        </p>
                        {pass.checkedInAt && (
                          <p className="text-[11px] text-white/40">
                            Checked in {new Date(pass.checkedInAt * 1000).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={rewardSelection.has(passKey)}
                        onChange={(event) => toggleRewardSelection(passKey, event.target.checked)}
                        className="h-4 w-4 accent-emerald-400"
                      />
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-white/60">No eligible passes just yet.</p>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-white/60">
              <p>{loyaltyStatus ?? "Select attendees and mint their POAPs."}</p>
              {loyaltyPasses.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    className="bg-white/10 px-3 py-1 text-[11px]"
                    onClick={() => toggleSelectAllRewards(true)}
                  >
                    Select all
                  </Button>
                  <Button
                    className="bg-white/10 px-3 py-1 text-[11px]"
                    onClick={() => toggleSelectAllRewards(false)}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <Button
                className="bg-emerald-400/70 px-4 py-2 text-xs text-slate-900"
                disabled={!rewardSelection.size || pendingAction === "loyalty-bulk"}
                onClick={issueSelectedRewards}
              >
                {pendingAction === "loyalty-bulk" ? "Minting..." : "Mint loyalty NFTs"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </GradientCard>
  );
};
