"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { GradientCard } from "@/components/ui/gradient-card";
import { useVaultPulse } from "@/lib/hooks/use-vault-pulse";

const sampleTimeline = [9.4, 10.3, 12.1, 11.6, 13.2, 15.5, 18.2];

export const YieldTimeline = () => {
  const { data } = useVaultPulse();
  const maxValue = Math.max(...sampleTimeline);
  const points = useMemo(() => sampleTimeline.map((value, idx) => {
    const x = (idx / (sampleTimeline.length - 1)) * 100;
    const y = 100 - (value / maxValue) * 100;
    return `${x},${y}`;
  }).join(" "), [maxValue]);

  return (
    <GradientCard className="flex flex-col gap-4 text-white lg:flex-row lg:items-center">
      <div className="flex-1 space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-white/60">Yield runway</p>
        <h3 className="text-2xl font-semibold">Treasury performance over the past week</h3>
        <p className="text-sm text-white/70">
          We route every ticket SOL into a whitelisted vault PDA. Hover the chart to see how harvests increased the
          balance. The stats refresh automatically from devnet via React Query.
        </p>
        <div className="flex gap-4 text-sm">
          <div>
            <p className="text-xs uppercase text-white/40">Deposited</p>
            <p className="text-xl font-semibold">{formatLamports(data?.deposited ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-white/40">Yield harvested</p>
            <p className="text-xl font-semibold">{formatLamports(data?.yield ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-white/40">Withdrawn</p>
            <p className="text-xl font-semibold">{formatLamports(data?.withdrawn ?? 0)}</p>
          </div>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <motion.svg
          viewBox="0 0 100 100"
          className="h-48 w-full max-w-xl"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.6, ease: "easeInOut" }}
        >
          <polyline
            fill="url(#fillGradient)"
            stroke="none"
            points={`${points} 100,100 0,100`}
            opacity={0.25}
          />
          <motion.polyline
            points={points}
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth={2}
            strokeLinecap="round"
          />
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2dd4bf" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
            <linearGradient id="fillGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
            </linearGradient>
          </defs>
        </motion.svg>
      </div>
    </GradientCard>
  );
};

const formatLamports = (lamports: number) => `${(lamports / 1_000_000_000).toFixed(2)} ◎`;
