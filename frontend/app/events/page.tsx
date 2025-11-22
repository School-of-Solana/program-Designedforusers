"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useEventFeed } from "@/lib/hooks/use-event-data";
import { GradientCard } from "@/components/ui/gradient-card";

const strategies = ["All", "Kamino", "Sanctum", "None"];

export default function EventsPage() {
  const { data, isLoading } = useEventFeed();
  const [search, setSearch] = useState("");
  const [strategyFilter, setStrategyFilter] = useState("All");
  const [startFilter, setStartFilter] = useState("");
  const [endFilter, setEndFilter] = useState("");

  const filteredEvents = useMemo(() => {
    if (!data) {
      return [];
    }
    return data.filter((event) => {
      const text = `${event.name} ${event.venue}`.toLowerCase();
      if (search && !text.includes(search.toLowerCase())) {
        return false;
      }
      if (strategyFilter !== "All" && event.strategy !== strategyFilter) {
        return false;
      }
      const startTs = new Date(event.start).getTime();
      if (startFilter) {
        const minTs = new Date(startFilter).getTime();
        if (startTs < minTs) {
          return false;
        }
      }
      if (endFilter) {
        const maxTs = new Date(endFilter).getTime();
        if (startTs > maxTs) {
          return false;
        }
      }
      return true;
    });
  }, [data, search, strategyFilter, startFilter, endFilter]);

  const stats = useMemo(() => {
    const totalEvents = filteredEvents.length;
    const totalPasses = filteredEvents.reduce((sum, event) => sum + (event.totalPasses ?? 0), 0);
    const totalCapacity = filteredEvents.reduce(
      (sum, event) =>
        sum +
        event.tiers.reduce((tierSum, tier) => tierSum + (tier.maxSupply ?? tier.available + (tier.sold ?? 0)), 0),
      0
    );
    return { totalEvents, totalPasses, totalCapacity };
  }, [filteredEvents]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 py-6">
      <GradientCard className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">Discovery feed</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Browse upcoming EventFlux activations</h1>
          <p className="text-sm text-white/70">
            Filter by yield strategy, venue keyword, or date range. All listings are live PDAs pulled straight from
            devnet via Anchor.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <input
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-white placeholder:text-white/30 focus:outline-none"
            placeholder="Search name or venue"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none"
            value={strategyFilter}
            onChange={(event) => setStrategyFilter(event.target.value)}
          >
            {strategies.map((strategy) => (
              <option key={strategy} value={strategy}>
                {strategy === "None" ? "Treasury only" : strategy}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none"
            value={startFilter}
            onChange={(event) => setStartFilter(event.target.value)}
          />
          <input
            type="date"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none"
            value={endFilter}
            onChange={(event) => setEndFilter(event.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Events live", value: stats.totalEvents },
            { label: "Passes sold", value: stats.totalPasses },
            { label: "Capacity tracked", value: stats.totalCapacity },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white/70">
              <p className="text-xs uppercase tracking-[0.3em]">{stat.label}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{stat.value}</p>
            </div>
          ))}
        </div>
      </GradientCard>
      {isLoading ? (
        <p className="text-sm text-white/60">Loading upcoming events…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredEvents.map((event) => {
            const nextTier = event.tiers[0];
            const soldOut = nextTier?.available === 0;
            return (
              <div key={event.publicKey} className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white/80">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xl font-semibold text-white">{event.name}</p>
                    <p className="text-xs text-white/60">{event.venue}</p>
                  </div>
                  {soldOut && (
                    <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] uppercase tracking-wide text-white">
                      Sold out
                    </span>
                  )}
                </div>
                <p className="mt-3 text-sm text-white/60">
                  {new Date(event.start).toLocaleString()} → {new Date(event.end).toLocaleString()}
                </p>
                <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                  {event.tiers.map((tier) => (
                    <div key={tier.tier} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <p className="text-xs uppercase text-white/50">{tier.tier}</p>
                      <p className="text-lg font-semibold text-white">{tier.price} ◎</p>
                      <p className="text-xs text-white/50">{tier.available} available</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap justify-between gap-2 text-xs text-white/50">
                  <span>Yield strategy: {event.strategy}</span>
                  <span>{event.totalPasses} passes minted</span>
                </div>
                <div className="mt-4 flex gap-3">
                  <Link
                    href={`/events/${event.publicKey}`}
                    className="flex-1 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-center text-xs font-semibold text-white"
                  >
                    View details
                  </Link>
                  <Link
                    href="/#attendee"
                    className="flex-1 rounded-full border border-white/30 bg-white/5 px-4 py-2 text-center text-xs font-semibold text-white/80"
                  >
                    Mint via dashboard
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
