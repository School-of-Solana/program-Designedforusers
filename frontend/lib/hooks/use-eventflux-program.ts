"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { useMemo } from "react";
import { eventFluxIdl } from "@/lib/env";

// Minimal wallet interface for read-only operations
interface MinimalWallet {
  publicKey: PublicKey;
  signTransaction: <T>(tx: T) => Promise<T>;
  signAllTransactions: <T>(txs: T[]) => Promise<T[]>;
}

function createReadonlyWallet(publicKey?: PublicKey): MinimalWallet {
  return {
    publicKey: publicKey ?? PublicKey.default,
    signTransaction: async () => {
      throw new Error("Connect a wallet to sign transactions");
    },
    signAllTransactions: async () => {
      throw new Error("Connect a wallet to sign transactions");
    },
  };
}

export const useEventFluxProgram = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { connected, publicKey, signTransaction, signAllTransactions } = wallet;

  const program = useMemo(() => {
    if (!connection) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anchorWallet: any =
      connected && publicKey && signTransaction && signAllTransactions
        ? {
            publicKey,
            signTransaction,
            signAllTransactions,
          }
        : createReadonlyWallet(publicKey ?? undefined);

    const provider = new AnchorProvider(connection, anchorWallet, {
      commitment: "confirmed",
    });

    // Anchor Program constructor for @coral-xyz/anchor@0.32 expects (idl, provider?)
    // and infers the program ID from idl.address.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Program(eventFluxIdl as any, provider) as any;
  }, [connection, connected, publicKey, signTransaction, signAllTransactions]);

  return {
    program,
    wallet,
  };
};
