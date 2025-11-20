"use client";

import { GradientCard } from "@/components/ui/gradient-card";
import { useVaultPulse } from "@/lib/hooks/use-vault-pulse";

const formatLamports = (lamports: number) => `${(lamports / 1_000_000_000).toFixed(2)} SOL`;

export const StatGrid = () => {
  const { data } = useVaultPulse();

  const stats = [
    { label: "Deposited", value: formatLamports(data?.deposited ?? 0) },
    { label: "Harvested Yield", value: formatLamports(data?.yield ?? 0) },
    { label: "Settled", value: formatLamports(data?.withdrawn ?? 0) },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-3">
      {stats.map((stat) => (
        <GradientCard key={stat.label} className="text-white">
          <p className="text-sm uppercase tracking-wide text-white/60">{stat.label}</p>
          <p className="mt-2 text-3xl font-semibold">{stat.value}</p>
        </GradientCard>
      ))}
    </section>
  );
};
