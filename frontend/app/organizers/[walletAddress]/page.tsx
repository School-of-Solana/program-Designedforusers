"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { useQuery } from "@tanstack/react-query";
import { GradientCard } from "@/components/ui/gradient-card";
import { useEventFluxProgram } from "@/lib/hooks/use-eventflux-program";

const useOrganizerProfile = (address?: string) => {
  const { program } = useEventFluxProgram();

  return useQuery({
    queryKey: ["eventflux", "organizer-profile", address],
    enabled: Boolean(program && address),
    queryFn: async () => {
      if (!program || !address) {
        return [];
      }
      const organizer = new PublicKey(address);
      const filters = [
        {
          memcmp: {
            offset: 8 + 1 + 8,
            bytes: organizer.toBase58(),
          },
        },
      ];
      const events = await program.account.event.all(filters);
      const enriched = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        events.map(async ({ publicKey, account }: any) => {
          const vaultStatePk = new PublicKey(account.vaultState);
          const vaultState = await program.account.vaultState.fetch(vaultStatePk);
          return { publicKey, account, vaultState };
        })
      );
      return enriched;
    },
    placeholderData: [],
  });
};

export default function OrganizerProfilePage() {
  const params = useParams<{ walletAddress: string }>();
  const walletAddress = params.walletAddress;
  const { data, isLoading } = useOrganizerProfile(walletAddress);

  const stats = useMemo(() => {
    const totalEvents = data?.length ?? 0;
    const totalPasses = data?.reduce((sum, entry) => sum + Number(entry.account.totalPasses), 0) ?? 0;
    const totalYield =
      data?.reduce((sum, entry) => sum + Number(entry.vaultState.totalYieldHarvested) / 1_000_000_000, 0) ?? 0;
    return { totalEvents, totalPasses, totalYield };
  }, [data]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 py-6">
      <GradientCard className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">Organizer profile</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            {walletAddress
              ? `Wallet ${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`
              : "Unknown organizer"}
          </h1>
          <p className="text-sm text-white/70">
            Aggregated stats across every EventFlux activation published by this organizer wallet.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { label: "Events hosted", value: stats.totalEvents },
            { label: "Passes sold", value: stats.totalPasses },
            { label: "Yield harvested", value: `${stats.totalYield.toFixed(2)} ◎` },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-white/70">
              <p className="text-xs uppercase tracking-[0.3em]">{stat.label}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{stat.value}</p>
            </div>
          ))}
        </div>
        {isLoading ? (
          <p className="text-sm text-white/60">Loading organizer events…</p>
        ) : data && data.length ? (
          <div className="space-y-4">
            {data.map(({ publicKey, account, vaultState }) => (
              <div key={publicKey.toBase58()} className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white/80">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xl font-semibold text-white">{account.name}</p>
                    <p className="text-xs text-white/60">{account.venue}</p>
                  </div>
                  <Link href={`/events/${publicKey.toBase58()}`} className="text-xs text-white underline">
                    View →
                  </Link>
                </div>
                <div className="mt-3 grid gap-3 text-xs md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-white/60">Passes minted</p>
                    <p className="text-lg font-semibold text-white">{Number(account.totalPasses)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-white/60">Deposited</p>
                    <p className="text-lg font-semibold text-white">
                      {(Number(vaultState.totalDeposited) / 1_000_000_000).toFixed(2)} ◎
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-white/60">Yield harvested</p>
                    <p className="text-lg font-semibold text-white">
                      {(Number(vaultState.totalYieldHarvested) / 1_000_000_000).toFixed(2)} ◎
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-4 text-sm text-white/60">
            No events detected for this organizer just yet.
          </p>
        )}
      </GradientCard>
    </div>
  );
}
