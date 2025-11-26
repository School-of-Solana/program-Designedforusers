/**
 * Error Handling Utilities
 *
 * Provides comprehensive error categorization and user-friendly
 * messaging for Solana and Anchor errors.
 */

import { AnchorError, ProgramError } from "@coral-xyz/anchor";

/**
 * Error categories for UI handling
 */
export type ErrorCategory =
  | "wallet"
  | "network"
  | "program"
  | "validation"
  | "timeout"
  | "user_rejected"
  | "insufficient_funds"
  | "unknown";

/**
 * Structured error with category and user message
 */
export interface CategorizedError {
  category: ErrorCategory;
  code: string;
  message: string;
  userMessage: string;
  recoverable: boolean;
  suggestedAction?: string;
}

/**
 * EventFlux-specific error codes from the Anchor program
 */
const EVENTFLUX_ERROR_CODES: Record<string, { message: string; action: string }> = {
  EventNotActive: {
    message: "Event is not currently active",
    action: "Check the event's start and end times",
  },
  TierNotFound: {
    message: "The selected tier doesn't exist",
    action: "Refresh the page and try a different tier",
  },
  TierSoldOut: {
    message: "This tier is sold out",
    action: "Try a different tier or check back later",
  },
  AlreadyCheckedIn: {
    message: "This pass has already been checked in",
    action: "No action needed - you're already checked in!",
  },
  UnauthorizedVerifier: {
    message: "You're not authorized to verify this pass",
    action: "Contact the event organizer for verifier access",
  },
  PassNotCheckedIn: {
    message: "Pass must be checked in first",
    action: "Check in to the event before claiming loyalty rewards",
  },
  LoyaltyAlreadyIssued: {
    message: "Loyalty NFT already claimed",
    action: "You've already received your loyalty NFT",
  },
  EventNotEnded: {
    message: "Event hasn't ended yet",
    action: "Treasury withdrawal is available after the event ends",
  },
  AlreadySettled: {
    message: "Event treasury has already been settled",
    action: "Funds have already been withdrawn",
  },
  NoYieldStrategy: {
    message: "No yield strategy configured",
    action: "This event doesn't support yield harvesting",
  },
  InvalidHarvestAmount: {
    message: "Invalid harvest amount",
    action: "Enter a valid amount to harvest",
  },
  MathOverflow: {
    message: "Calculation overflow error",
    action: "Please try a smaller amount",
  },
  InvalidMetadata: {
    message: "Invalid event metadata",
    action: "Check your input values and try again",
  },
  InvalidSchedule: {
    message: "Invalid event schedule",
    action: "End time must be after start time",
  },
};

/**
 * Common Solana/Anchor error patterns
 */
const COMMON_ERROR_PATTERNS: Array<{
  pattern: RegExp;
  category: ErrorCategory;
  userMessage: string;
  action?: string;
}> = [
  {
    pattern: /User rejected|rejected the request|user denied/i,
    category: "user_rejected",
    userMessage: "Transaction was cancelled",
    action: "Click the button again to retry",
  },
  {
    pattern: /insufficient funds|not enough SOL|0x1/i,
    category: "insufficient_funds",
    userMessage: "Insufficient SOL balance",
    action: "Add more SOL to your wallet",
  },
  {
    pattern: /wallet not connected/i,
    category: "wallet",
    userMessage: "Wallet not connected",
    action: "Connect your wallet to continue",
  },
  {
    pattern: /network|connection|fetch|timeout/i,
    category: "network",
    userMessage: "Network connection issue",
    action: "Check your internet connection and try again",
  },
  {
    pattern: /blockhash|expired|block height exceeded/i,
    category: "timeout",
    userMessage: "Transaction expired",
    action: "Please try again - the network was slow",
  },
  {
    pattern: /simulation failed|0x0/i,
    category: "program",
    userMessage: "Transaction simulation failed",
    action: "The transaction would fail - check your inputs",
  },
  {
    pattern: /account.*not found|Account does not exist/i,
    category: "program",
    userMessage: "Account not found",
    action: "The requested data doesn't exist on-chain",
  },
];

/**
 * Categorize an error and return user-friendly information
 */
export function categorizeError(error: unknown): CategorizedError {
  // Handle null/undefined
  if (!error) {
    return {
      category: "unknown",
      code: "UNKNOWN",
      message: "Unknown error occurred",
      userMessage: "Something went wrong",
      recoverable: true,
      suggestedAction: "Please try again",
    };
  }

  // Handle Anchor errors
  if (error instanceof AnchorError) {
    const errorCode = error.error.errorCode.code;
    const knownError = EVENTFLUX_ERROR_CODES[errorCode];

    if (knownError) {
      return {
        category: "program",
        code: errorCode,
        message: error.error.errorMessage,
        userMessage: knownError.message,
        recoverable: true,
        suggestedAction: knownError.action,
      };
    }

    return {
      category: "program",
      code: errorCode,
      message: error.error.errorMessage,
      userMessage: `Program error: ${error.error.errorMessage}`,
      recoverable: true,
      suggestedAction: "Check your inputs and try again",
    };
  }

  // Handle Program errors
  if (error instanceof ProgramError) {
    return {
      category: "program",
      code: `PROGRAM_${error.code}`,
      message: error.msg,
      userMessage: error.msg,
      recoverable: true,
      suggestedAction: "Check your inputs and try again",
    };
  }

  // Handle standard errors with message
  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);

  // Check against common patterns
  for (const { pattern, category, userMessage, action } of COMMON_ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return {
        category,
        code: category.toUpperCase(),
        message: errorMessage,
        userMessage,
        recoverable: category !== "user_rejected",
        suggestedAction: action,
      };
    }
  }

  // Default unknown error
  return {
    category: "unknown",
    code: "UNKNOWN",
    message: errorMessage,
    userMessage: "An unexpected error occurred",
    recoverable: true,
    suggestedAction: "Please try again or refresh the page",
  };
}

/**
 * Get a short error message suitable for toasts
 */
export function getShortErrorMessage(error: unknown): string {
  const categorized = categorizeError(error);
  return categorized.userMessage;
}

/**
 * Check if an error is recoverable (user can retry)
 */
export function isRecoverableError(error: unknown): boolean {
  const categorized = categorizeError(error);
  return categorized.recoverable;
}

/**
 * Check if error was user-initiated (cancelled)
 */
export function isUserRejection(error: unknown): boolean {
  const categorized = categorizeError(error);
  return categorized.category === "user_rejected";
}

/**
 * Format error for logging (includes full details)
 */
export function formatErrorForLogging(error: unknown): string {
  const categorized = categorizeError(error);
  return JSON.stringify(
    {
      category: categorized.category,
      code: categorized.code,
      message: categorized.message,
      timestamp: new Date().toISOString(),
    },
    null,
    2
  );
}

/**
 * React-friendly error boundary fallback props
 */
export interface ErrorFallbackProps {
  error: CategorizedError;
  resetErrorBoundary: () => void;
}
