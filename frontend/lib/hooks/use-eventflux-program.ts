"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { useMemo } from "react";
import { eventFluxIdl, type EventFluxIdl } from "@/lib/env";

class ReadonlyWallet implements Wallet {
  public publicKey: PublicKey;

  constructor(publicKey?: PublicKey) {
    this.publicKey = publicKey ?? PublicKey.default;
  }

  async signTransaction(): Promise<never> {
    throw new Error("Connect a wallet to sign transactions");
  }

  async signAllTransactions(): Promise<never[]> {
    throw new Error("Connect a wallet to sign transactions");
  }
}

export const useEventFluxProgram = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { connected, publicKey, signTransaction, signAllTransactions } = wallet;

  const program = useMemo(() => {
    if (!connection) {
      return null;
    }

    const anchorWallet: Wallet =
      connected && publicKey && signTransaction && signAllTransactions
        ? {
            publicKey,
            signTransaction,
            signAllTransactions,
          }
        : new ReadonlyWallet(publicKey ?? undefined);

    const provider = new AnchorProvider(connection, anchorWallet, {
      commitment: "confirmed",
    });

    // Anchor Program constructor for @coral-xyz/anchor@0.32 expects (idl, provider?)
    // and infers the program ID from idl.address.
    return new Program<EventFluxIdl>(eventFluxIdl as EventFluxIdl, provider);
  }, [connection, connected, publicKey, signTransaction, signAllTransactions]);

  return {
    program,
    wallet,
  };
};
