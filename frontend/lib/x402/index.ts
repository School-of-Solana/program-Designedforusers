/**
 * x402 Payment Protocol for Solana
 *
 * EventFlux x402 implementation enables AI agents and automated systems
 * to pay for event access, pass minting, and analytics programmatically.
 *
 * @example Server-side (API route)
 * ```ts
 * import { withX402Payment, EVENTFLUX_PRICING, X402ServerConfig } from "@/lib/x402";
 *
 * const config: X402ServerConfig = {
 *   network: "solana-devnet",
 *   treasuryAddress: "YOUR_TREASURY_ADDRESS",
 * };
 *
 * export async function GET(request: Request) {
 *   return withX402Payment(
 *     request,
 *     config,
 *     EVENTFLUX_PRICING.eventListing(),
 *     async (payer) => {
 *       // Handle paid request
 *       return Response.json({ events: [...] });
 *     }
 *   );
 * }
 * ```
 *
 * @example Client-side (React component)
 * ```ts
 * import { createX402Client } from "@/lib/x402";
 * import { useWallet } from "@solana/wallet-adapter-react";
 * import { useConnection } from "@solana/wallet-adapter-react";
 *
 * function MyComponent() {
 *   const wallet = useWallet();
 *   const { connection } = useConnection();
 *
 *   const client = createX402Client(wallet, connection, {
 *     network: "solana-devnet",
 *     maxPaymentAmount: BigInt(1e9), // 1 SOL max
 *   });
 *
 *   const fetchData = async () => {
 *     const response = await client.fetch("/api/x402/events");
 *     const data = await response.json();
 *   };
 * }
 * ```
 */

// Types
export * from "./types";

// Server utilities
export {
  create402Response,
  decodePaymentHeader,
  verifyPayment,
  createSettlementResponse,
  withX402Payment,
  EVENTFLUX_PRICING,
} from "./server";

// Client utilities
export {
  createPaymentHeader,
  selectPaymentRequirements,
  parseSettlementResponse,
  x402Fetch,
  createX402Client,
  useX402PaymentInfo,
} from "./client";
