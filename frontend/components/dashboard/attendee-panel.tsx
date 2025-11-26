"use client";

import { useCallback, useMemo, useState } from "react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { encodeURL } from "@solana/pay";
import QRCode from "react-qr-code";
import { useClipboard } from "use-clipboard-copy";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { TransactionStatus } from "@/components/ui/transaction-status";
import { useEventFeed } from "@/lib/hooks/use-event-data";
import { useEventFluxProgram } from "@/lib/hooks/use-eventflux-program";
import { useWalletPasses } from "@/lib/hooks/use-wallet-passes";
import { useTransaction } from "@/lib/hooks/use-transaction";
import { getEventPassPda, getVaultTreasuryPda } from "@/lib/pdas";
import type { UiEvent } from "@/lib/placeholders";

export const AttendeePanel = () => {
  const { data: events } = useEventFeed();
  const { data: passes } = useWalletPasses();
  const wallet = useWallet();
  const { program } = useEventFluxProgram();
  const queryClient = useQueryClient();
  const clipboard = useClipboard();
  const mintTx = useTransaction();
  const checkInTx = useTransaction();
  const [pendingPass, setPendingPass] = useState<string | null>(null);
  const [qrModal, setQrModal] = useState<{
    pass: PublicKey;
    event: PublicKey;
    url: string;
    eventName: string;
  } | null>(null);
  const [appOrigin] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : "https://eventflux.app"
  );
  const [qrCopied, setQrCopied] = useState(false);

  const featured = useMemo(() => events?.slice(0, 3) ?? [], [events]);
  const eventMap = useMemo(() => {
    const map = new Map<string, UiEvent>();
    events?.forEach((event) => map.set(event.publicKey, event));
    return map;
  }, [events]);

  const handleMint = useCallback(
    async (eventAddress: string, tierId: number) => {
      if (!wallet.connected || !wallet.publicKey || !program) {
        return;
      }

      await mintTx.execute(
        async () => {
          const eventPk = new PublicKey(eventAddress);
          const eventAccount = await program.account.event.fetch(eventPk);
          const vaultStatePk = new PublicKey(eventAccount.vaultState);
          const vaultTreasury = await getVaultTreasuryPda(eventPk);
          const eventPass = await getEventPassPda(eventPk, wallet.publicKey!, tierId);

          return program.methods
            .mintPass(tierId)
            .accounts({
              attendee: wallet.publicKey!,
              event: eventPk,
              vaultState: vaultStatePk,
              vaultTreasury,
              eventPass,
              systemProgram: SystemProgram.programId,
            })
            .rpc();
        },
        {
          onConfirmed: () => {
            queryClient.invalidateQueries({ queryKey: ["eventflux"] });
          },
        }
      );
    },
    [wallet.connected, wallet.publicKey, program, queryClient, mintTx]
  );

  const handleSelfCheckIn = useCallback(
    async (passPk: PublicKey, eventPk: PublicKey) => {
      if (!wallet.connected || !wallet.publicKey || !program) {
        return;
      }
      setPendingPass(passPk.toBase58());

      await checkInTx.execute(
        async () => {
          return program.methods
            .checkIn()
            .accounts({
              verifier: wallet.publicKey!,
              event: eventPk,
              eventPass: passPk,
            })
            .rpc();
        },
        {
          onConfirmed: () => {
            queryClient.invalidateQueries({
              queryKey: ["eventflux", "passes", wallet.publicKey!.toBase58()],
            });
            setPendingPass(null);
          },
          onFailed: () => {
            setPendingPass(null);
          },
        }
      );
    },
    [wallet.connected, wallet.publicKey, program, queryClient, checkInTx]
  );

  const openPassQr = useCallback(
    (passPk: PublicKey, eventPk: PublicKey) => {
      const eventInfo = eventMap.get(eventPk.toBase58());
      const link = new URL(`${appOrigin}/verify`);
      link.searchParams.set("event", eventPk.toBase58());
      link.searchParams.set("pass", passPk.toBase58());
      if (wallet.publicKey) {
        link.searchParams.set("owner", wallet.publicKey.toBase58());
      }

      const encoded = encodeURL({
        link,
        label: `${eventInfo?.name ?? "EventFlux"} check-in`,
        message: "Scan to validate this pass in EventFlux.",
        memo: passPk.toBase58(),
      });

      setQrModal({
        pass: passPk,
        event: eventPk,
        url: encoded.toString(),
        eventName: eventInfo?.name ?? "EventFlux Pass",
      });
      setQrCopied(false);
    },
    [eventMap, appOrigin, wallet.publicKey]
  );

  const closeQrModal = () => {
    setQrModal(null);
    setQrCopied(false);
  };

  const handleCopyQr = () => {
    if (!qrModal) {
      return;
    }
    clipboard.copy(qrModal.url);
    setQrCopied(true);
    setTimeout(() => setQrCopied(false), 1400);
  };

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
                disabled={!wallet.connected || !program || mintTx.isLoading || !event.tiers.length}
                onClick={() => handleMint(event.publicKey, event.tiers[0]?.tierId ?? 1)}
              >
                {wallet.connected ? (mintTx.isLoading ? "Minting..." : "Mint pass") : "Connect to mint"}
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
                <div key={tier.label} className="rounded-xl border border-white/5 bg-white/5 px-3 py-2">
                  <p className="text-xs uppercase text-white/50">{tier.label}</p>
                  <p className="text-base font-semibold">{tier.price} ◎</p>
                  <p className="text-xs text-white/50">{tier.available} left</p>
                  <Button
                    type="button"
                    className="mt-2 w-full bg-white/20 px-3 py-1 text-[11px]"
                    disabled={!wallet.connected || !program || mintTx.isLoading}
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
      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-white">My passes</p>
            <p className="text-xs text-white/50">Self check-in or reveal QR for the verifier.</p>
          </div>
          <span className="text-xs text-white/40">{passes?.length ?? 0} owned</span>
        </div>
        <div className="mt-3 space-y-3">
          {passes?.length ? (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            passes.map(({ publicKey, account }: any) => {
              const eventInfo = eventMap.get(account.event.toBase58());
              return (
                <div
                  key={publicKey.toBase58()}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {eventInfo?.name ?? "Event"} · Tier {account.tierId}
                      </p>
                      <p className="text-xs text-white/50">
                        Pass {publicKey.toBase58().slice(0, 6)}… • {eventInfo?.venue ?? "Venue TBD"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="bg-white/20 px-3 py-1 text-xs"
                        disabled={account.checkedIn || pendingPass === publicKey.toBase58() || !wallet.connected}
                        onClick={() => handleSelfCheckIn(publicKey, account.event)}
                      >
                        {account.checkedIn
                          ? "Checked in"
                          : pendingPass === publicKey.toBase58()
                            ? "Checking..."
                            : "Check in"}
                      </Button>
                      <Button
                        type="button"
                        className="bg-white/10 px-3 py-1 text-[11px]"
                        disabled={!wallet.connected}
                        onClick={() => openPassQr(publicKey, account.event)}
                      >
                        Show pass
                      </Button>
                    </div>
                  </div>
                  {account.checkedIn && account.checkedInAt && (
                    <p className="mt-2 text-[11px] text-emerald-300">
                      Checked in at {new Date(Number(account.checkedInAt) * 1000).toLocaleString()}
                    </p>
                  )}
                </div>
              );
            })
          ) : (
            <p className="rounded-2xl border border-dashed border-white/15 bg-black/30 p-4 text-sm text-white/60">
              Mint an EventFlux pass to see it here.
            </p>
          )}
        </div>
      </div>
      {qrModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 px-4 py-6">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#080716] p-6 text-center shadow-2xl">
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">Show pass</p>
            <h3 className="mt-1 text-2xl font-semibold text-white">{qrModal.eventName}</h3>
            <p className="mt-2 text-sm text-white/60">Scan with the EventFlux verifier app or Solana Pay to auto-fill the check-in transaction.</p>
            <div className="mt-5 flex justify-center">
              <div className="rounded-3xl border border-white/20 bg-white p-5 text-slate-900 shadow-xl">
                <QRCode value={qrModal.url} size={180} fgColor="#020617" bgColor="transparent" />
                <p className="mt-3 text-center text-xs font-semibold uppercase tracking-wide">Solana Pay deep link</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Button className="bg-white/10 px-4 py-2 text-xs" onClick={handleCopyQr}>
                {qrCopied ? "Copied!" : "Copy URI"}
              </Button>
              <Button className="bg-white/20 px-4 py-2 text-xs" onClick={closeQrModal}>
                Close
              </Button>
            </div>
            <p className="mt-3 break-all text-[11px] text-white/40">{qrModal.url}</p>
          </div>
        </div>
      )}
      {/* Transaction Status */}
      {mintTx.status !== "idle" && (
        <TransactionStatus
          status={mintTx.status}
          signature={mintTx.signature}
          error={mintTx.error}
          suggestedAction={mintTx.errorDetails?.suggestedAction}
          onDismiss={mintTx.reset}
        />
      )}
      {checkInTx.status !== "idle" && (
        <TransactionStatus
          status={checkInTx.status}
          signature={checkInTx.signature}
          error={checkInTx.error}
          suggestedAction={checkInTx.errorDetails?.suggestedAction}
          onDismiss={checkInTx.reset}
        />
      )}
    </GradientCard>
  );
};
