"use client";

import { useMemo, useState } from "react";
import { useClipboard } from "use-clipboard-copy";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { useEventFeed } from "@/lib/hooks/use-event-data";
import { placeholderEvents } from "@/lib/placeholders";

const buildSolanaPayUrl = (recipient: string, amount: number, label: string, message: string) => {
  const params = new URLSearchParams({
    amount: amount.toString(),
    label,
    message,
  });
  return `solana:${recipient}?${params.toString()}`;
};

export const SolanaPayPanel = () => {
  const { data } = useEventFeed();
  const clipboard = useClipboard();
  const [copied, setCopied] = useState(false);
  const selectedEvent = useMemo(() => data?.[0] ?? placeholderEvents[0], [data]);
  const solanaPayUrl = buildSolanaPayUrl(
    selectedEvent.publicKey,
    selectedEvent.tiers[0]?.price ?? 0.5,
    `${selectedEvent.name} · ${selectedEvent.tiers[0]?.tier ?? "GA"}`,
    "Scan to mint your EventFlux pass"
  );

  return (
    <GradientCard className="flex flex-col gap-4 md:flex-row md:items-center">
      <div className="flex-1 space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-white/60">Solana Pay check-in</p>
        <h3 className="text-2xl font-semibold text-white">Scan to mint or confirm arrival</h3>
        <p className="text-sm text-white/70">
          Drop this QR at the venue door or send it to VIPs. It encodes a Solana Pay link targeting the event PDA
          so attendees can mint passes or confirm they reached the venue.
        </p>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-white/70">
          <p>Destination event: <span className="font-mono text-white">{selectedEvent.publicKey.slice(0, 12)}…</span></p>
          <p>Tier default: {selectedEvent.tiers[0]?.tier ?? "GA"}</p>
        </div>
        <Button
          type="button"
          className="bg-white/20 px-4 py-2 text-xs"
          onClick={() => {
            clipboard.copy(solanaPayUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied!" : "Copy Solana Pay URI"}
        </Button>
      </div>
      <div className="flex justify-center">
        <div className="rounded-3xl border border-white/20 bg-white p-5 text-slate-900 shadow-xl">
          <QRCode value={solanaPayUrl} size={180} fgColor="#020617" bgColor="transparent" />
          <p className="mt-3 text-center text-xs font-semibold uppercase tracking-wide">Tap wallet to mint</p>
        </div>
      </div>
    </GradientCard>
  );
};
