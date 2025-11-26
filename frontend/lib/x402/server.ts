/**
 * x402 Server-Side Payment Handler for Solana
 *
 * Handles payment verification and settlement for protected API resources.
 * AI agents can pay for access using Solana native SOL or SPL tokens.
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  X402_VERSION,
  X402_SCHEME,
  PaymentRequirement,
  PaymentRequiredResponse,
  SolanaPaymentPayload,
  PaymentVerificationResult,
  PaymentSettlementResponse,
  X402ServerConfig,
  ResourcePricing,
} from "./types";

const DEFAULT_TIMEOUT_SECONDS = 300; // 5 minutes

/**
 * Creates a 402 Payment Required response
 */
export function create402Response(
  config: X402ServerConfig,
  pricing: ResourcePricing,
  error = "Payment required"
): Response {
  const paymentRequired: PaymentRequiredResponse = {
    x402Version: X402_VERSION,
    error,
    accepts: [
      {
        scheme: X402_SCHEME,
        network: config.network,
        maxAmountRequired: pricing.pricelamports.toString(),
        resource: pricing.path,
        description: pricing.description,
        mimeType: "application/json",
        payTo: config.treasuryAddress,
        maxTimeoutSeconds: pricing.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS,
        asset: pricing.asset,
        extra: {
          name: pricing.asset === "SOL" ? "Solana" : "SPL Token",
          decimals: pricing.asset === "SOL" ? 9 : 6,
        },
      },
    ],
  };

  return new Response(JSON.stringify(paymentRequired), {
    status: 402,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Expose-Headers": "X-PAYMENT-RESPONSE",
    },
  });
}

/**
 * Extracts and decodes the X-PAYMENT header
 */
export function decodePaymentHeader(
  headerValue: string
): SolanaPaymentPayload | null {
  try {
    const decoded = Buffer.from(headerValue, "base64").toString("utf-8");
    return JSON.parse(decoded) as SolanaPaymentPayload;
  } catch {
    return null;
  }
}

/**
 * Verifies a Solana payment on-chain
 */
export async function verifyPayment(
  config: X402ServerConfig,
  payment: SolanaPaymentPayload,
  requirements: PaymentRequirement
): Promise<PaymentVerificationResult> {
  const rpcUrl = config.rpcUrl ?? "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  try {
    // Validate payment metadata
    if (payment.x402Version !== X402_VERSION) {
      return { isValid: false, invalidReason: "unsupported_x402_version" };
    }

    if (payment.scheme !== X402_SCHEME) {
      return { isValid: false, invalidReason: "unsupported_scheme" };
    }

    if (payment.network !== config.network) {
      return { isValid: false, invalidReason: "network_mismatch" };
    }

    const { signature, authorization } = payment.payload;

    // Check recipient matches treasury
    if (authorization.to !== config.treasuryAddress) {
      return { isValid: false, invalidReason: "invalid_recipient" };
    }

    // Check payment amount
    const requiredAmount = BigInt(requirements.maxAmountRequired);
    const paidAmount = BigInt(authorization.value);
    if (paidAmount < requiredAmount) {
      return { isValid: false, invalidReason: "insufficient_amount" };
    }

    // Check time window
    const now = Math.floor(Date.now() / 1000);
    if (now < authorization.validAfter) {
      return { isValid: false, invalidReason: "payment_not_yet_valid" };
    }
    if (now > authorization.validBefore) {
      return { isValid: false, invalidReason: "payment_expired" };
    }

    // Verify transaction on-chain
    const txResult = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!txResult) {
      return { isValid: false, invalidReason: "transaction_not_found" };
    }

    if (txResult.meta?.err) {
      return { isValid: false, invalidReason: "transaction_failed" };
    }

    // Verify the transaction transferred the correct amount to treasury
    const preBalances = txResult.meta?.preBalances ?? [];
    const postBalances = txResult.meta?.postBalances ?? [];
    const accountKeys = txResult.transaction.message.getAccountKeys();

    let treasuryIndex = -1;
    for (let i = 0; i < accountKeys.length; i++) {
      if (accountKeys.get(i)?.toBase58() === config.treasuryAddress) {
        treasuryIndex = i;
        break;
      }
    }

    if (treasuryIndex === -1) {
      return { isValid: false, invalidReason: "treasury_not_in_transaction" };
    }

    const treasuryReceived = BigInt(postBalances[treasuryIndex] - preBalances[treasuryIndex]);
    if (treasuryReceived < requiredAmount) {
      return { isValid: false, invalidReason: "insufficient_transfer_amount" };
    }

    return {
      isValid: true,
      payer: authorization.from,
    };
  } catch (error) {
    console.error("Payment verification error:", error);
    return {
      isValid: false,
      invalidReason: "verification_error",
    };
  }
}

/**
 * Creates a settlement response header value
 */
export function createSettlementResponse(
  success: boolean,
  transactionSignature?: string,
  error?: string
): string {
  const settlement: PaymentSettlementResponse = {
    success,
    transactionSignature,
    settledAt: success ? Date.now() : undefined,
    error,
  };

  return Buffer.from(JSON.stringify(settlement)).toString("base64");
}

/**
 * Middleware helper to protect an API route with x402 payment
 */
export async function withX402Payment(
  request: Request,
  config: X402ServerConfig,
  pricing: ResourcePricing,
  handler: (payer: string) => Promise<Response>
): Promise<Response> {
  const paymentHeader = request.headers.get("X-PAYMENT");

  // No payment header - return 402
  if (!paymentHeader) {
    return create402Response(config, pricing);
  }

  // Decode payment
  const payment = decodePaymentHeader(paymentHeader);
  if (!payment) {
    return create402Response(config, pricing, "Invalid payment header format");
  }

  // Create payment requirement for verification
  const requirement: PaymentRequirement = {
    scheme: X402_SCHEME,
    network: config.network,
    maxAmountRequired: pricing.pricelamports.toString(),
    resource: pricing.path,
    description: pricing.description,
    mimeType: "application/json",
    payTo: config.treasuryAddress,
    maxTimeoutSeconds: pricing.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS,
    asset: pricing.asset,
  };

  // Verify payment
  const verification = await verifyPayment(config, payment, requirement);

  if (!verification.isValid) {
    return create402Response(
      config,
      pricing,
      `Payment verification failed: ${verification.invalidReason}`
    );
  }

  // Payment valid - process request
  const response = await handler(verification.payer!);

  // Add settlement header
  const settlementHeader = createSettlementResponse(
    true,
    payment.payload.signature
  );

  const newHeaders = new Headers(response.headers);
  newHeaders.set("X-PAYMENT-RESPONSE", settlementHeader);
  newHeaders.set("Access-Control-Expose-Headers", "X-PAYMENT-RESPONSE");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * Pre-defined pricing for EventFlux resources
 */
export const EVENTFLUX_PRICING = {
  // Premium event data access
  eventData: (eventId: string): ResourcePricing => ({
    path: `/api/x402/events/${eventId}`,
    description: `Access to event ${eventId} data`,
    pricelamports: BigInt(0.001 * LAMPORTS_PER_SOL), // 0.001 SOL
    asset: "SOL",
    timeoutSeconds: 300,
  }),

  // Mint pass via API (for AI agents)
  mintPass: (eventId: string, tierId: number): ResourcePricing => ({
    path: `/api/x402/mint`,
    description: `Mint tier ${tierId} pass for event ${eventId}`,
    pricelamports: BigInt(0.01 * LAMPORTS_PER_SOL), // Base fee, actual price added
    asset: "SOL",
    timeoutSeconds: 60,
  }),

  // Bulk event listing
  eventListing: (): ResourcePricing => ({
    path: "/api/x402/events",
    description: "Access to full event listing with analytics",
    pricelamports: BigInt(0.0005 * LAMPORTS_PER_SOL), // 0.0005 SOL
    asset: "SOL",
    timeoutSeconds: 300,
  }),

  // Organizer analytics
  analytics: (organizerAddress: string): ResourcePricing => ({
    path: `/api/x402/analytics/${organizerAddress}`,
    description: `Analytics for organizer ${organizerAddress}`,
    pricelamports: BigInt(0.005 * LAMPORTS_PER_SOL), // 0.005 SOL
    asset: "SOL",
    timeoutSeconds: 300,
  }),
};
