"use client";

import { useMemo, useState } from "react";
import { encodeURL } from "@solana/pay";
import QRCode from "react-qr-code";
import { useClipboard } from "use-clipboard-copy";
import Link from "next/link";
import { GradientCard } from "@/components/ui/gradient-card";
import { useEventFeed } from "@/lib/hooks/use-event-data";
import { placeholderEvents } from "@/lib/placeholders";
import { Button } from "@/components/ui/button";

export const SolanaPayPanel = () => {
  const { data } = useEventFeed();
  const clipboard = useClipboard();
  const [copiedCheckIn, setCopiedCheckIn] = useState(false);
  const [copiedGuest, setCopiedGuest] = useState(false);
  const [appOrigin] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : "https://eventflux.app"
  );

  const selectedEvent = useMemo(() => data?.[0] ?? placeholderEvents[0], [data]);

  const checkInLink = useMemo(() => {
    const link = new URL(`${appOrigin}/verify`);
    link.searchParams.set("event", selectedEvent.publicKey);
    const encoded = encodeURL({
      link,
      label: `${selectedEvent.name} · Check-in`,
      message: "Scan to approve EventFlux attendance.",
      memo: selectedEvent.publicKey,
    });
    return encoded.toString();
  }, [appOrigin, selectedEvent]);

  const guestPassLink = useMemo(() => {
    const tierId = selectedEvent.tiers[0]?.tierId ?? 1;
    const link = new URL(`${appOrigin}/claim`);
    link.searchParams.set("event", selectedEvent.publicKey);
    link.searchParams.set("tier", String(tierId));
    return link.toString();
  }, [appOrigin, selectedEvent]);

  return (
    <GradientCard className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">Solana Pay Toolkit</p>
          <h3 className="text-2xl font-semibold text-white">Door-ready QR experiences</h3>
          <p className="text-sm text-white/70">
            Share the verifier QR with your staff and drop the guest-pass QR at the entrance so newcomers can mint in
            one flow.
          </p>
        </div>
        <Link href="/verify" className="text-xs text-white/70 underline">
          Open scanner →
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-white/15 bg-black/20 p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">Verifier QR</p>
          <h4 className="mt-1 text-lg font-semibold text-white">{selectedEvent.name}</h4>
          <p className="mt-1 text-sm text-white/60">
            Scan with any wallet on <code className="font-mono text-xs">/verify</code> to pre-fill the check-in
            instruction.
          </p>
          <div className="mt-4 flex justify-center">
            <div className="rounded-3xl border border-white/20 bg-white p-5 text-slate-900 shadow-xl">
              <QRCode value={checkInLink} size={160} fgColor="#020617" bgColor="transparent" />
              <p className="mt-3 text-center text-[11px] font-semibold uppercase tracking-wide">Verifier deep link</p>
            </div>
          </div>
          <Button
            type="button"
            className="mt-4 w-full bg-white/20 px-4 py-2 text-xs"
            onClick={() => {
              clipboard.copy(checkInLink);
              setCopiedCheckIn(true);
              setTimeout(() => setCopiedCheckIn(false), 1500);
            }}
          >
            {copiedCheckIn ? "Copied!" : "Copy Solana Pay URI"}
          </Button>
          <p className="mt-2 break-all text-[11px] text-white/50">{checkInLink}</p>
        </div>
        <div className="rounded-3xl border border-white/15 bg-black/20 p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">Guest pass</p>
          <h4 className="mt-1 text-lg font-semibold text-white">Frictionless mint</h4>
          <p className="mt-1 text-sm text-white/60">
            Non-crypto attendees scan to open a claim page where they connect a wallet (or embedded custody) and mint the
            default tier.
          </p>
          <div className="mt-4 flex justify-center">
            <div className="rounded-3xl border border-white/20 bg-white p-5 text-slate-900 shadow-xl">
              <QRCode value={guestPassLink} size={160} fgColor="#020617" bgColor="transparent" />
              <p className="mt-3 text-center text-[11px] font-semibold uppercase tracking-wide">Claim in browser</p>
            </div>
          </div>
          <Button
            type="button"
            className="mt-4 w-full bg-white/20 px-4 py-2 text-xs"
            onClick={() => {
              clipboard.copy(guestPassLink);
              setCopiedGuest(true);
              setTimeout(() => setCopiedGuest(false), 1500);
            }}
          >
            {copiedGuest ? "Copied!" : "Copy guest link"}
          </Button>
          <p className="mt-2 break-all text-[11px] text-white/50">{guestPassLink}</p>
        </div>
      </div>
    </GradientCard>
  );
};
