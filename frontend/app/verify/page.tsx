"use client";

import dynamic from "next/dynamic";
import { Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import type { Result } from "@zxing/library";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { useEventFluxProgram } from "@/lib/hooks/use-eventflux-program";

const DynamicQrReader = dynamic(async () => (await import("react-qr-reader")).QrReader, {
  ssr: false,
});

type ScanFormState = {
  event: string;
  pass: string;
  owner: string;
};

const parseSolanaUrl = (raw: string) => {
  const sanitized = raw.startsWith("solana:") ? raw.replace("solana:", "") : raw;
  try {
    const url = new URL(sanitized);
    return {
      event: url.searchParams.get("event") ?? "",
      pass: url.searchParams.get("pass") ?? "",
      owner: url.searchParams.get("owner") ?? "",
    };
  } catch {
    return null;
  }
};

export default function VerifyPage() {
  return (
    <Suspense fallback={<VerifyPageFallback />}>
      <VerifyPageContent />
    </Suspense>
  );
}

function VerifyPageFallback() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 py-6">
      <GradientCard className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">Verifier scanner</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Loading...</h1>
        </div>
      </GradientCard>
    </div>
  );
}

function VerifyPageContent() {
  const searchParams = useSearchParams();
  const wallet = useWallet();
  const { program } = useEventFluxProgram();
  const queryClient = useQueryClient();

  const [formState, setFormState] = useState<ScanFormState>({
    event: searchParams.get("event") ?? "",
    pass: searchParams.get("pass") ?? "",
    owner: searchParams.get("owner") ?? "",
  });
  const [latestScan, setLatestScan] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isReady = useMemo(() => formState.event.length > 0 && formState.pass.length > 0, [formState]);

  const handleResult = useCallback(
    (result?: Result | null) => {
      if (!result) {
        return;
      }
      const text = result.getText();
      if (!text || text === latestScan) {
        return;
      }
      const parsed = parseSolanaUrl(text);
      if (parsed) {
        setFormState(parsed);
        setLatestScan(text);
        setStatus("QR parsed — review details and approve.");
      } else {
        setStatus("Scanned code missing EventFlux metadata.");
      }
    },
    [latestScan]
  );

  const handleManualInput = (field: keyof ScanFormState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value.trim() }));
  };

  const handleCheckIn = async () => {
    if (!wallet.connected || !wallet.publicKey || !program) {
      setStatus("Connect your verifier wallet.");
      return;
    }
    if (!isReady) {
      setStatus("Event + pass PDA required.");
      return;
    }
    let eventPk: PublicKey;
    let passPk: PublicKey;
    try {
      eventPk = new PublicKey(formState.event);
      passPk = new PublicKey(formState.pass);
    } catch {
      setStatus("Invalid public key format. Check event/pass addresses.");
      return;
    }
    setPending(true);
    setStatus("Dispatching check_in instruction…");
    try {
      await program.methods
        .checkIn()
        .accounts({
          verifier: wallet.publicKey,
          event: eventPk,
          eventPass: passPk,
        })
        .rpc();

      await queryClient.invalidateQueries({ queryKey: ["eventflux"] });
      setStatus("Attendee checked in! Issue loyalty NFTs from the treasury panel.");
    } catch (error) {
      console.error(error);
      setStatus("Check-in failed. Confirm authority + event window.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 py-6">
      <GradientCard className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">Verifier scanner</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Confirm arrivals in under 5 seconds</h1>
          <p className="text-sm text-white/70">
            Point your device at attendee QR codes (generated from the dashboard) or paste the pass/event PDAs manually.
            The check_in instruction is prefilled with the right accounts.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">Live scanner</p>
            <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/60">
              <DynamicQrReader
                constraints={{ facingMode: "environment" }}
                onResult={handleResult}
                scanDelay={800}
                videoStyle={{ width: "100%" }}
              />
            </div>
            <p className="mt-2 text-[11px] text-white/50">
              Latest payload: {latestScan ? latestScan.slice(0, 32) + "…" : "Waiting for QR…"}
            </p>
          </div>
          <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
            <label className="space-y-1">
              <span>Event PDA</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-white placeholder:text-white/30 focus:outline-none"
                value={formState.event}
                onChange={(event) => handleManualInput("event", event.target.value)}
                placeholder="Event PDA"
              />
            </label>
            <label className="space-y-1">
              <span>Pass PDA</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-white placeholder:text-white/30 focus:outline-none"
                value={formState.pass}
                onChange={(event) => handleManualInput("pass", event.target.value)}
                placeholder="EventPass PDA"
              />
            </label>
            <label className="space-y-1">
              <span>Owner (optional)</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-white placeholder:text-white/30 focus:outline-none"
                value={formState.owner}
                onChange={(event) => handleManualInput("owner", event.target.value)}
                placeholder="Attendee wallet"
              />
            </label>
            <Button
              type="button"
              className="w-full bg-emerald-400/70 px-4 py-2 text-xs text-slate-900"
              disabled={!isReady || pending}
              onClick={handleCheckIn}
            >
              {pending ? "Checking in..." : "Approve check_in"}
            </Button>
            <p className="text-xs text-white/50">
              Requires organizer or delegated verifier signature. Attendees can also self-check in from their dashboard.
            </p>
          </div>
        </div>
        {status && <p className="text-xs text-white/60">{status}</p>}
      </GradientCard>
    </div>
  );
}
