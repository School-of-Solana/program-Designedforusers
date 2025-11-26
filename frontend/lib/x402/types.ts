/**
 * x402 Protocol Types for Solana Native Payments
 *
 * Implements HTTP 402 Payment Required protocol for machine-to-machine
 * payments on Solana. Enables AI agents to programmatically pay for
 * event access, pass minting, and premium features.
 */

export const X402_VERSION = 1;
export const X402_SCHEME = "exact";
export const X402_NETWORK_MAINNET = "solana";
export const X402_NETWORK_DEVNET = "solana-devnet";

/**
 * Payment requirement returned in 402 response
 */
export interface PaymentRequirement {
  scheme: "exact";
  network: "solana" | "solana-devnet";
  maxAmountRequired: string; // In lamports or token atomic units
  resource: string;
  description: string;
  mimeType: string;
  payTo: string; // Recipient wallet address
  maxTimeoutSeconds: number;
  asset: "SOL" | string; // "SOL" for native, or SPL token mint address
  extra?: {
    name?: string;
    decimals?: number;
    eventId?: string;
    tierId?: number;
  };
}

/**
 * 402 Payment Required response body
 */
export interface PaymentRequiredResponse {
  x402Version: number;
  error: string;
  accepts: PaymentRequirement[];
}

/**
 * Solana payment authorization (pre-signed transaction data)
 */
export interface SolanaPaymentAuthorization {
  from: string; // Payer wallet
  to: string; // Recipient wallet
  value: string; // Amount in atomic units
  validAfter: number; // Unix timestamp
  validBefore: number; // Unix timestamp
  nonce: string; // Unique nonce to prevent replay
  asset: "SOL" | string;
}

/**
 * Payment payload sent in X-PAYMENT header
 */
export interface SolanaPaymentPayload {
  x402Version: number;
  scheme: "exact";
  network: "solana" | "solana-devnet";
  payload: {
    signature: string; // Transaction signature
    authorization: SolanaPaymentAuthorization;
  };
}

/**
 * Settlement response returned in X-PAYMENT-RESPONSE header
 */
export interface PaymentSettlementResponse {
  success: boolean;
  transactionSignature?: string;
  settledAt?: number;
  error?: string;
}

/**
 * Verification result from facilitator
 */
export interface PaymentVerificationResult {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
}

/**
 * x402 client configuration
 */
export interface X402ClientConfig {
  network: "solana" | "solana-devnet";
  rpcUrl?: string;
  maxPaymentAmount?: bigint; // Safety limit
}

/**
 * x402 server configuration
 */
export interface X402ServerConfig {
  network: "solana" | "solana-devnet";
  treasuryAddress: string;
  rpcUrl?: string;
  defaultAsset?: "SOL" | string;
}

/**
 * Protected resource pricing configuration
 */
export interface ResourcePricing {
  path: string;
  description: string;
  pricelamports: bigint;
  asset: "SOL" | string;
  timeoutSeconds?: number;
}
