"use client";

import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { Button } from "./button";

export const WalletButton = () => {
  const { setVisible } = useWalletModal();
  const { connected, publicKey, disconnect } = useWallet();

  if (connected && publicKey) {
    return (
      <Button onClick={() => disconnect()} className="bg-white/20 px-4 py-2 text-xs uppercase tracking-wide">
        {publicKey.toBase58().slice(0, 4)}…{publicKey.toBase58().slice(-4)} · Disconnect
      </Button>
    );
  }

  return (
    <Button onClick={() => setVisible(true)} className="bg-white text-slate-900 px-4 py-2 text-xs font-bold">
      Connect Wallet
    </Button>
  );
};
