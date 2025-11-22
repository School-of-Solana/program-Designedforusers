"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { Button } from "@/components/ui/button";
import { WalletButton } from "@/components/ui/wallet-button";

export const HeroSection = () => {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!glowRef.current) return;
    const ctx = gsap.context(() => {
      gsap.to(glowRef.current, {
        rotate: 360,
        duration: 60,
        repeat: -1,
        ease: "linear",
      });
    });
    return () => ctx.revert();
  }, []);

  return (
    <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-gradient-to-b from-[#1b1b2f] via-[#0b0b17] to-[#080612] p-10 shadow-2xl">
      <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center">
        <div className="flex-1 space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-1 text-xs uppercase tracking-[0.2em] text-white/70">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Live on Solana Devnet
          </div>
          <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
            On-chain event passes that grow your treasury before doors open.
          </h1>
          <p className="max-w-2xl text-base text-white/70 sm:text-lg">
            EventFlux mints verifiable passes, routes ticket flow into whitelisted yield vaults, and lets
            organizers close the loop with loyalty NFTs — all from one glassy dashboard.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/events"
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white px-6 py-3 text-sm font-bold text-slate-900 transition hover:bg-white/90"
            >
              Explore Event Pipeline
            </Link>
            <Button className="border-white/30 bg-transparent px-6 py-3 text-sm font-semibold">
              Watch the Vault Flywheel
            </Button>
            <WalletButton />
          </div>
        </div>
        <div className="relative flex-1">
          <div ref={glowRef} className="absolute inset-0 -z-10 rounded-full bg-gradient-to-tr from-cyan-400/30 via-fuchsia-500/20 to-transparent blur-[120px]" />
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white backdrop-blur-xl">
            <div className="text-sm uppercase text-white/60">Last Vault Harvest</div>
            <div className="mt-2 text-4xl font-semibold">+312.44 SOL</div>
            <p className="mt-1 text-white/60">Auto-compounded from Kamino x EventFlux strategy safe.</p>
            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-white/60">Passes Minted</p>
                <p className="text-2xl font-semibold">1,204</p>
              </div>
              <div>
                <p className="text-white/60">Yield Coverage</p>
                <p className="text-2xl font-semibold">241%</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
