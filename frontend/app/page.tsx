import { HeroSection } from "@/components/landing/hero-section";
import { StatGrid } from "@/components/landing/stat-grid";
import { YieldTimeline } from "@/components/landing/yield-timeline";
import { OrganizerPanel } from "@/components/dashboard/organizer-panel";
import { AttendeePanel } from "@/components/dashboard/attendee-panel";
import { VerifierPanel } from "@/components/dashboard/verifier-panel";
import { TreasuryPanel } from "@/components/dashboard/treasury-panel";
import { SolanaPayPanel } from "@/components/dashboard/solana-pay-panel";
import { X402Panel } from "@/components/dashboard/x402-panel";

export default function Home() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <HeroSection />
      <StatGrid />
      <YieldTimeline />
      <section id="attendee" className="grid gap-6 lg:grid-cols-2">
        <OrganizerPanel />
        <AttendeePanel />
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <VerifierPanel />
        <TreasuryPanel />
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <SolanaPayPanel />
        <X402Panel />
      </section>
      <section className="rounded-[32px] border border-white/10 bg-gradient-to-r from-white/5 to-white/0 p-6 text-white">
        <h3 className="text-2xl font-semibold">Technical Highlights</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          {[
            { title: "Anchor Program", desc: "Secure on-chain event management with PDA-based passes" },
            { title: "Yield Vault CPI", desc: "Auto-compound ticket revenue via composable adapters" },
            { title: "Loyalty NFTs", desc: "POAP-style rewards for checked-in attendees" },
            { title: "x402 Payments", desc: "AI agent commerce with HTTP 402 protocol" },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              <p className="text-white font-semibold">{item.title}</p>
              <p className="mt-2 text-white/50 text-xs">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
