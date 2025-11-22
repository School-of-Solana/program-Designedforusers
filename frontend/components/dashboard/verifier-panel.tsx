"use client";

import { ChangeEvent, useCallback, useMemo, useState } from "react";
import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { useEventFluxProgram } from "@/lib/hooks/use-eventflux-program";
import { useEventFeed } from "@/lib/hooks/use-event-data";
import type { UiEvent } from "@/lib/placeholders";

type SearchMode = "owner" | "pass";

const toPublicKey = (value: PublicKey | string): PublicKey => {
  return value instanceof PublicKey ? value : new PublicKey(value);
};

type RawEventPassAccount = {
  event: PublicKey | string;
  owner: PublicKey | string;
  tierId: number;
  checkedIn: boolean;
  checkedInAt: BN | null;
};

type PassRecord = {
  publicKey: PublicKey;
  account: {
    event: PublicKey;
    owner: PublicKey;
    tierId: number;
    checkedIn: boolean;
    checkedInAt: number | null;
  };
};

export const VerifierPanel = () => {
  const wallet = useWallet();
  const { program } = useEventFluxProgram();
  const { data: events } = useEventFeed();
  const queryClient = useQueryClient();

  const [searchMode, setSearchMode] = useState<SearchMode>("owner");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [checking, setChecking] = useState(false);
  const [results, setResults] = useState<PassRecord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<string | null>(null);
  const [inlinePending, setInlinePending] = useState<string | null>(null);

  const eventMap = useMemo(() => {
    const map = new Map<string, UiEvent>();
    events?.forEach((event) => map.set(event.publicKey, event));
    return map;
  }, [events]);

  const toggleSelection = useCallback((passPk: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(passPk);
      } else {
        next.delete(passPk);
      }
      return next;
    });
  }, []);

  const resetSelection = useCallback((passes: PassRecord[]) => {
    const next = new Set<string>();
    passes.forEach(({ publicKey, account }) => {
      if (!account.checkedIn) {
        next.add(publicKey.toBase58());
      }
    });
    setSelected(next);
  }, []);

  const runSearch = useCallback(async () => {
    if (!program) {
      setStatus("Connect your wallet to load passes.");
      return;
    }
    if (!query.trim()) {
      setStatus("Enter a wallet address or pass PDA.");
      return;
    }
    setSearching(true);
    setStatus("Fetching passes…");
    try {
      const trimmed = query.trim();
      let passes: PassRecord[] = [];

      const shapeRecord = (publicKey: PublicKey, account: RawEventPassAccount): PassRecord => ({
        publicKey,
        account: {
          event: toPublicKey(account.event),
          owner: toPublicKey(account.owner),
          tierId: account.tierId,
          checkedIn: account.checkedIn,
          checkedInAt: account.checkedInAt ? Number(account.checkedInAt) : null,
        },
      });

      if (searchMode === "owner") {
        const owner = new PublicKey(trimmed);
        const filters = [
          {
            memcmp: {
              offset: 8 + 1 + 32, // disc + bump + event pubkey
              bytes: owner.toBase58(),
            },
          },
        ];
        const fetched = await program.account.eventPass.all(filters);
        passes = fetched.map(({ publicKey, account }) => shapeRecord(publicKey, account));
      } else {
        const passPk = new PublicKey(trimmed);
        const account = await program.account.eventPass.fetch(passPk);
        passes = [shapeRecord(passPk, account)];
      }

      setResults(passes);
      resetSelection(passes);
      setStatus(
        passes.length
          ? `Loaded ${passes.length} pass${passes.length > 1 ? "es" : ""}. Select and check in.`
          : "No passes found for that query."
      );
    } catch (error) {
      console.error(error);
      setStatus("Failed to load passes. Confirm the address is valid and owned by your event.");
      setResults([]);
      setSelected(new Set());
    } finally {
      setSearching(false);
    }
  }, [program, query, searchMode, resetSelection]);

  const performCheckIn = useCallback(
    async (pass: PassRecord) => {
      if (!wallet.connected || !wallet.publicKey || !program) {
        throw new Error("Connect verifier wallet.");
      }
      await program.methods
        .checkIn()
        .accounts({
          verifier: wallet.publicKey,
          event: pass.account.event,
          eventPass: pass.publicKey,
        })
        .rpc();
    },
    [wallet.connected, wallet.publicKey, program]
  );

  const handleSingleCheckIn = useCallback(
    async (pass: PassRecord) => {
      setInlinePending(pass.publicKey.toBase58());
      setStatus("Submitting check-in…");
      try {
        await performCheckIn(pass);
        await queryClient.invalidateQueries({ queryKey: ["eventflux"] });
        await runSearch();
        setStatus("Pass checked in.");
      } catch (error) {
        console.error(error);
        setStatus("Single check-in failed. Try again.");
      } finally {
        setInlinePending(null);
      }
    },
    [performCheckIn, queryClient, runSearch]
  );

  const handleBulkCheckIn = useCallback(async () => {
    if (!wallet.connected || !wallet.publicKey) {
      setStatus("Connect an organizer/verifier wallet.");
      return;
    }
    const targets = results.filter((record) => selected.has(record.publicKey.toBase58()) && !record.account.checkedIn);
    if (!targets.length) {
      setStatus("Select at least one unchecked pass.");
      return;
    }
    setChecking(true);
    setStatus("Checking in selected passes…");
    try {
      await Promise.all(targets.map((pass) => performCheckIn(pass)));
      await queryClient.invalidateQueries({ queryKey: ["eventflux"] });
      await runSearch();
      setStatus(`Checked in ${targets.length} pass${targets.length > 1 ? "es" : ""}.`);
    } catch (error) {
      console.error(error);
      setStatus("Bulk check-in failed. Refresh and try again.");
    } finally {
      setChecking(false);
    }
  }, [wallet.connected, wallet.publicKey, results, selected, performCheckIn, queryClient, runSearch]);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };

  return (
    <GradientCard className="space-y-5">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-white/60">Verifier tools</p>
        <h2 className="mt-2 text-xl font-semibold text-white">Bulk check-in attendees</h2>
        <p className="text-sm text-white/60">
          Paste an attendee wallet or specific pass PDA. Select rows to confirm arrival in batches without leaving
          the door line.
        </p>
      </header>
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/80">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <select
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-wide text-white focus:outline-none"
            value={searchMode}
            onChange={(event) => setSearchMode(event.target.value as SearchMode)}
          >
            <option value="owner">Search by Wallet</option>
            <option value="pass">Search by Pass PDA</option>
          </select>
          <input
            value={query}
            onChange={handleInputChange}
            placeholder={searchMode === "owner" ? "Attendee wallet address" : "EventPass PDA"}
            className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-white placeholder:text-white/30 focus:outline-none"
          />
          <Button
            type="button"
            className="bg-white/20 px-4 py-2 text-xs"
            disabled={searching}
            onClick={runSearch}
          >
            {searching ? "Searching…" : "Search"}
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          {results.length ? (
            results.map(({ publicKey, account }) => {
              const passKey = publicKey.toBase58();
              const eventInfo = eventMap.get(account.event.toBase58());
              return (
                <div
                  key={passKey}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/70"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(passKey)}
                      disabled={account.checkedIn}
                      onChange={(event) => toggleSelection(passKey, event.target.checked)}
                      className="h-4 w-4 accent-white"
                    />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-semibold text-white">
                        {eventInfo?.name ?? "Event"} · Tier {account.tierId}
                      </p>
                      <p>
                        Pass {passKey.slice(0, 6)}… owner {account.owner.toBase58().slice(0, 4)}…
                        {account.owner.toBase58().slice(-4)}
                      </p>
                      <p className="text-[11px] text-white/40">
                        {eventInfo?.venue ?? "Venue TBD"} • Event {account.event.toBase58().slice(0, 6)}…
                      </p>
                    </div>
                    <Button
                      type="button"
                      className="bg-white/15 px-3 py-1 text-[11px]"
                      disabled={
                        account.checkedIn || checking || inlinePending === passKey || !wallet.connected
                      }
                      onClick={() => handleSingleCheckIn({ publicKey, account })}
                    >
                      {account.checkedIn
                        ? "Checked"
                        : inlinePending === passKey
                          ? "Checking..."
                          : "Check now"}
                    </Button>
                  </div>
                  {account.checkedIn && account.checkedInAt && (
                    <p className="mt-2 text-[11px] text-emerald-300">
                      Checked in at {new Date(Number(account.checkedInAt) * 1000).toLocaleString()}
                    </p>
                  )}
                </div>
              );
            })
          ) : (
            <p className="rounded-2xl border border-dashed border-white/15 bg-black/30 p-4 text-xs text-white/50">
              Results appear here. Wallet searches return every tier for that attendee.
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-white/60">
          {selected.size
            ? `${selected.size} selected · unchecked passes stay highlighted`
            : "Select passes to unlock batch check-in."}
        </p>
        <Button
          type="button"
          className="bg-emerald-400/30 px-4 py-2 text-xs text-white"
          disabled={checking || !selected.size}
          onClick={handleBulkCheckIn}
        >
          {checking ? "Checking…" : "Check in selected"}
        </Button>
      </div>
      {status && <p className="text-xs text-white/60">{status}</p>}
    </GradientCard>
  );
};
