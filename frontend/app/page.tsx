import { HeroSection } from "@/components/landing/hero-section";
import { StatGrid } from "@/components/landing/stat-grid";
import { YieldTimeline } from "@/components/landing/yield-timeline";
import { OrganizerPanel } from "@/components/dashboard/organizer-panel";
import { AttendeePanel } from "@/components/dashboard/attendee-panel";
import { VerifierPanel } from "@/components/dashboard/verifier-panel";
import { TreasuryPanel } from "@/components/dashboard/treasury-panel";
import { SolanaPayPanel } from "@/components/dashboard/solana-pay-panel";

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
      <SolanaPayPanel />
      <section className="rounded-[32px] border border-white/10 bg-gradient-to-r from-white/5 to-white/0 p-6 text-white">
        <h3 className="text-2xl font-semibold">Product storyline</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {["Anchor program", "Yield vault CPI", "Loyalty NFTs"].map((item) => (
            <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              <p className="text-white font-semibold">{item}</p>
              <p className="mt-2 text-white/70">
                See the full flow in the README — program IDs, IDL, and devnet deployment commands are ready
                for recruiters.
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
