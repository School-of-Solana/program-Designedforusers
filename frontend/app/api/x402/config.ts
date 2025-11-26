/**
 * x402 API Configuration
 *
 * Shared configuration for all x402-protected API routes.
 */

import { X402ServerConfig } from "@/lib/x402";
import { solanaNetwork, rpcEndpoint } from "@/lib/env";

/**
 * Treasury address for receiving x402 payments.
 * In production, this should be a secure multisig or program-controlled PDA.
 */
const TREASURY_ADDRESS =
  process.env.EVENTFLUX_X402_TREASURY ??
  "HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH"; // Default devnet treasury

export const x402Config: X402ServerConfig = {
  network: solanaNetwork === "mainnet-beta" ? "solana" : "solana-devnet",
  treasuryAddress: TREASURY_ADDRESS,
  rpcUrl: rpcEndpoint,
};

/**
 * Whether x402 payments are enabled.
 * Set EVENTFLUX_X402_ENABLED=false to disable payment requirements.
 */
export const x402Enabled = process.env.EVENTFLUX_X402_ENABLED !== "false";
