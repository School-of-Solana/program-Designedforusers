"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { useMemo } from "react";
import { eventFluxIdl, type EventFluxIdl } from "@/lib/env";

class ReadonlyWallet {
  public publicKey: PublicKey;

  constructor(publicKey?: PublicKey) {
    this.publicKey = publicKey ?? PublicKey.default;
  }

  async signTransaction(): Promise<any> {
    throw new Error("Connect a wallet to sign transactions");
  }

  async signAllTransactions(): Promise<any[]> {
    throw new Error("Connect a wallet to sign transactions");
  }
}

export const useEventFluxProgram = () => {
  const { connection } = useConnection();
  const wallet = useWallet();

  const program = useMemo(() => {
    if (!connection) {
      return null;
    }

    const anchorWallet = wallet.connected && wallet.publicKey && wallet.signTransaction
      ? (wallet as any)
      : new ReadonlyWallet(wallet.publicKey ?? undefined);

    const provider = new AnchorProvider(connection, anchorWallet, {
      commitment: "confirmed",
    });

    // Anchor Program constructor for @coral-xyz/anchor@0.32 expects (idl, provider?)
    // and infers the program ID from idl.address.
    return new Program<EventFluxIdl>(eventFluxIdl as EventFluxIdl, provider);
  }, [connection, wallet.connected, wallet.publicKey, wallet.signTransaction]);

  return {
    program,
    wallet,
  };
};
