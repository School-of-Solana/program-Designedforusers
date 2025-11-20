import { PublicKey } from "@solana/web3.js";
import idl from "./eventflux-idl.json" assert { type: "json" };

export const rpcEndpoint =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

export const programId = new PublicKey(
  process.env.NEXT_PUBLIC_EVENTFLUX_PROGRAM_ID ?? (idl as { address: string }).address
);

export const adapterProgramId = new PublicKey(
  process.env.NEXT_PUBLIC_EVENTFLUX_ADAPTER_ID ?? "9zDeQgUTkwW1X2xW9ZZcACToGt9Lzoz1nAm88PtMu912"
);

export type EventFluxIdl = typeof idl;
export const eventFluxIdl = idl as unknown as EventFluxIdl;
