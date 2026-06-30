/**
 * StorageErrors — Typed error hierarchy for storage operations.
 *
 * Every provider maps its native errors to these types so the UI
 * can render consistent error messages and retry logic.
 */

/** Error codes that the UI can switch on for rendering and retry logic. */
export type StorageErrorCode =
  | "NOT_FOUND"
  | "PERMISSION_DENIED"
  | "ALREADY_EXISTS"
  | "QUOTA_EXCEEDED"
  | "NAME_INVALID"
  | "PATH_TOO_LONG"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "AUTH_EXPIRED"
  | "AUTH_REQUIRED"
  | "RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "OPERATION_NOT_SUPPORTED"
  | "CONFLICT"
  | "CORRUPTED"
  | "UNKNOWN";

/**
 * Structured error returned by all storage operations.
 * Extends Error for stack trace compatibility.
 */
export class StorageError extends Error {
  /** Machine-readable error code. */
  readonly code: StorageErrorCode;
  /** Provider that produced the error. */
  readonly providerId: string;
  /** HTTP status code from the provider, if applicable. */
  readonly statusCode?: number;
  /** Whether the operation can be retried. */
  readonly retryable: boolean;
  /** Suggested retry delay in milliseconds, if retryable. */
  readonly retryAfterMs?: number;
  /** Original error from the provider SDK, for debugging. */
  readonly cause?: unknown;

  constructor(params: {
    code: StorageErrorCode;
    message: string;
    providerId: string;
    statusCode?: number;
    retryable?: boolean;
    retryAfterMs?: number;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = "StorageError";
    this.code = params.code;
    this.providerId = params.providerId;
    this.statusCode = params.statusCode;
    this.retryable = params.retryable ?? false;
    this.retryAfterMs = params.retryAfterMs;
    this.cause = params.cause;
  }
}
