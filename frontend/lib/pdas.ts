import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { programId } from "@/lib/env";

const EVENT_SEED = Buffer.from("event");
const PASS_SEED = Buffer.from("event-pass");
const VAULT_STATE_SEED = Buffer.from("vault-state");
const VAULT_TREASURY_SEED = Buffer.from("vault-treasury");
const LOYALTY_MINT_SEED = Buffer.from("loyalty-mint");
const ADAPTER_RESERVE_SEED = Buffer.from("adapter-reserve");

export const getEventPda = async (organizer: PublicKey, eventId: BN) => {
  const [event] = await PublicKey.findProgramAddress(
    [EVENT_SEED, organizer.toBuffer(), eventId.toArrayLike(Buffer, "le", 8)],
    programId
  );
  return event;
};

export const getVaultStatePda = async (event: PublicKey) => {
  const [vaultState] = await PublicKey.findProgramAddress([VAULT_STATE_SEED, event.toBuffer()], programId);
  return vaultState;
};

export const getVaultTreasuryPda = async (event: PublicKey) => {
  const [treasury] = await PublicKey.findProgramAddress([VAULT_TREASURY_SEED, event.toBuffer()], programId);
  return treasury;
};

export const getEventPassPda = async (event: PublicKey, attendee: PublicKey, tierId: number) => {
  const [pass] = await PublicKey.findProgramAddress(
    [PASS_SEED, event.toBuffer(), attendee.toBuffer(), Buffer.from([tierId])],
    programId
  );
  return pass;
};

export const getLoyaltyMintPda = async (eventPass: PublicKey) => {
  const [mint] = await PublicKey.findProgramAddress(
    [LOYALTY_MINT_SEED, eventPass.toBuffer()],
    programId
  );
  return mint;
};

export const getAdapterReservePda = async (adapterProgram: PublicKey) => {
  const [adapter] = await PublicKey.findProgramAddress(
    [ADAPTER_RESERVE_SEED],
    adapterProgram
  );
  return adapter;
};
