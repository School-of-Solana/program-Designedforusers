/**
 * x402 Client-Side Payment Handler for Solana
 *
 * Provides automatic payment handling for protected API resources.
 * AI agents and frontend clients can use this to seamlessly pay for access.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Keypair,
} from "@solana/web3.js";
import { WalletContextState } from "@solana/wallet-adapter-react";
import {
  X402_VERSION,
  X402_SCHEME,
  X402ClientConfig,
  PaymentRequiredResponse,
  PaymentRequirement,
  SolanaPaymentPayload,
  SolanaPaymentAuthorization,
  PaymentSettlementResponse,
} from "./types";

/**
 * Creates an x402 payment header for Solana
 */
export async function createPaymentHeader(
  wallet: WalletContextState,
  connection: Connection,
  requirement: PaymentRequirement,
  config: X402ClientConfig
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected or does not support signing");
  }

  const amount = BigInt(requirement.maxAmountRequired);

  // Safety check
  if (config.maxPaymentAmount && amount > config.maxPaymentAmount) {
    throw new Error(
      `Payment amount ${amount} exceeds max allowed ${config.maxPaymentAmount}`
    );
  }

  // Create nonce for replay protection
  const nonce = Keypair.generate().publicKey.toBase58();

  // Set validity window (5 minute window)
  const validAfter = Math.floor(Date.now() / 1000) - 60; // 1 minute buffer
  const validBefore = validAfter + requirement.maxTimeoutSeconds + 120;

  // Create and sign payment transaction
  const recipient = new PublicKey(requirement.payTo);

  let transaction: Transaction;

  if (requirement.asset === "SOL") {
    // Native SOL transfer
    transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: recipient,
        lamports: Number(amount),
      })
    );
  } else {
    // SPL token transfer - would need token program instructions
    // For now, focus on SOL
    throw new Error("SPL token payments not yet implemented");
  }

  // Get recent blockhash
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  // Sign transaction
  const signedTx = await wallet.signTransaction(transaction);

  // Send transaction
  const signature = await connection.sendRawTransaction(signedTx.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });

  // Wait for confirmation
  await connection.confirmTransaction(
    {
      signature,
      blockhash,
      lastValidBlockHeight,
    },
    "confirmed"
  );

  // Create authorization data
  const authorization: SolanaPaymentAuthorization = {
    from: wallet.publicKey.toBase58(),
    to: recipient.toBase58(),
    value: amount.toString(),
    validAfter,
    validBefore,
    nonce,
    asset: requirement.asset,
  };

  // Create payment payload
  const payload: SolanaPaymentPayload = {
    x402Version: X402_VERSION,
    scheme: X402_SCHEME,
    network: config.network,
    payload: {
      signature,
      authorization,
    },
  };

  // Encode as base64
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

/**
 * Selects appropriate payment requirements from 402 response
 */
export function selectPaymentRequirements(
  accepts: PaymentRequirement[],
  network: "solana" | "solana-devnet",
  preferredAsset: "SOL" | string = "SOL"
): PaymentRequirement | null {
  // First try to match network and preferred asset
  const preferred = accepts.find(
    (req) => req.network === network && req.asset === preferredAsset
  );
  if (preferred) return preferred;

  // Fall back to any matching network
  const fallback = accepts.find((req) => req.network === network);
  return fallback ?? null;
}

/**
 * Parses the X-PAYMENT-RESPONSE header
 */
export function parseSettlementResponse(
  headerValue: string
): PaymentSettlementResponse | null {
  try {
    const decoded = Buffer.from(headerValue, "base64").toString("utf-8");
    return JSON.parse(decoded) as PaymentSettlementResponse;
  } catch {
    return null;
  }
}

/**
 * x402 fetch wrapper with automatic payment handling
 */
export async function x402Fetch(
  url: string,
  wallet: WalletContextState,
  connection: Connection,
  config: X402ClientConfig,
  init?: RequestInit
): Promise<Response> {
  // Make initial request
  const response = await fetch(url, init);

  // If not 402, return as-is
  if (response.status !== 402) {
    return response;
  }

  // Parse 402 response
  const paymentRequired: PaymentRequiredResponse = await response.json();

  // Select payment requirements
  const requirements = selectPaymentRequirements(
    paymentRequired.accepts,
    config.network
  );

  if (!requirements) {
    throw new Error(
      `No compatible payment options for network ${config.network}`
    );
  }

  // Create payment header
  const paymentHeader = await createPaymentHeader(
    wallet,
    connection,
    requirements,
    config
  );

  // Retry with payment
  const retryResponse = await fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      "X-PAYMENT": paymentHeader,
    },
  });

  return retryResponse;
}

/**
 * Creates an x402 client instance with bound wallet and config
 */
export function createX402Client(
  wallet: WalletContextState,
  connection: Connection,
  config: X402ClientConfig
) {
  return {
    /**
     * Make a fetch request with automatic x402 payment handling
     */
    fetch: (url: string, init?: RequestInit) =>
      x402Fetch(url, wallet, connection, config, init),

    /**
     * Check if a resource requires payment
     */
    checkPaymentRequired: async (
      url: string,
      init?: RequestInit
    ): Promise<PaymentRequirement | null> => {
      const response = await fetch(url, { ...init, method: "HEAD" });
      if (response.status !== 402) return null;

      const body: PaymentRequiredResponse = await response.json();
      return selectPaymentRequirements(body.accepts, config.network);
    },

    /**
     * Get the price for a resource in SOL
     */
    getResourcePrice: async (url: string): Promise<number | null> => {
      try {
        const response = await fetch(url, { method: "HEAD" });
        if (response.status !== 402) return null;

        const body: PaymentRequiredResponse = await response.json();
        const requirement = selectPaymentRequirements(body.accepts, config.network);
        if (!requirement) return null;

        return Number(requirement.maxAmountRequired) / LAMPORTS_PER_SOL;
      } catch {
        return null;
      }
    },
  };
}

/**
 * React hook for x402 payments (use in components)
 */
export function useX402PaymentInfo(paymentResponse: Response | null) {
  if (!paymentResponse) return null;

  const settlementHeader = paymentResponse.headers.get("X-PAYMENT-RESPONSE");
  if (!settlementHeader) return null;

  return parseSettlementResponse(settlementHeader);
}
