// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type InvoiceStatus = "pending" | "settled" | "expired";

export type PaymentStatus = "pending" | "processing" | "settled" | "failed";

export type TransactionType = "credit" | "debit";

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

export interface WalletResponse {
  walletId: string;
  name: string;
  /** Total balance in sats */
  balance: number;
  /** Amount held for pending payments in sats */
  onHold: number;
  /** Spendable balance in sats (balance − onHold) */
  available: number;
}

export interface CreateWalletRequest {
  name?: string | null;
}

export interface UpdateWalletRequest {
  name: string;
}

export interface CreateWalletResponse {
  walletId: string;
  primaryKey: string;
  secondaryKey: string;
  name: string;
  address: string;
  recoveryPassphrase: string;
}

// ---------------------------------------------------------------------------
// API Keys
// ---------------------------------------------------------------------------

export interface ApiKeyResponse {
  id: string;
  name: string;
  hint: string;
  createdAt: string | null;
  lastUsedAt: string | null;
}

export interface RotateApiKeyResponse {
  key: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export interface CreateInvoiceRequest {
  /** Amount in sats */
  amount: number;
  /** Caller-defined reference for tracking */
  reference?: string | null;
  /** Memo embedded in the BOLT11 invoice */
  memo?: string | null;
}

export interface InvoiceResponse {
  number: number;
  status: InvoiceStatus;
  amount: number;
  bolt11: string;
  reference: string | null;
  memo: string | null;
  txNumber: number | null;
  createdAt: string | null;
  settledAt: string | null;
  expiresAt: string | null;
}

export interface ListInvoicesParams {
  limit?: number;
  after?: number;
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export interface CreatePaymentRequest {
  /** Lightning address (user@domain) or BOLT11 invoice string */
  target: string;
  /** Amount in sats (required for addresses, optional for BOLT11) */
  amount?: number | null;
  /** Idempotency key to safely retry without duplicate payments */
  idempotencyKey?: string | null;
  /** Maximum routing fee in sats */
  maxFee?: number | null;
  /** Caller-defined reference for tracking */
  reference?: string | null;
}

export interface PaymentResponse {
  number: number;
  status: PaymentStatus;
  amount: number;
  maxFee: number;
  actualFee: number | null;
  address: string;
  reference: string | null;
  txNumber: number | null;
  failureReason: string | null;
  createdAt: string | null;
  settledAt: string | null;
}

export interface ListPaymentsParams {
  limit?: number;
  after?: number;
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

export interface CreateAddressRequest {
  /** Vanity address to claim, or null for a random one */
  address?: string | null;
}

export interface AddressResponse {
  address: string;
  generated: boolean;
  cost: number;
  createdAt: string | null;
}

export interface TransferAddressRequest {
  targetWalletKey: string;
}

export interface TransferAddressResponse {
  address: string;
  transferredTo: string;
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export interface TransactionResponse {
  number: number;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  networkFee: number;
  serviceFee: number;
  paymentHash: string | null;
  preimage: string | null;
  reference: string | null;
  note: string | null;
  createdAt: string | null;
}

export interface ListTransactionsParams {
  limit?: number;
  after?: number;
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

export interface CreateWebhookRequest {
  url: string;
}

export interface CreateWebhookResponse {
  id: string;
  url: string;
  /** Signing secret — returned only on creation */
  secret: string;
  createdAt: string | null;
}

export interface WebhookResponse {
  id: string;
  url: string;
  active: boolean;
  createdAt: string | null;
}

// ---------------------------------------------------------------------------
// Backup – Recovery
// ---------------------------------------------------------------------------

export interface RecoveryBackupResponse {
  passphrase: string;
}

// ---------------------------------------------------------------------------
// Restore – Recovery
// ---------------------------------------------------------------------------

export interface RecoveryRestoreRequest {
  passphrase: string;
}

export interface RecoveryRestoreResponse {
  walletId: string;
  name: string;
  primaryKey: string;
  secondaryKey: string;
}

// ---------------------------------------------------------------------------
// Backup – Passkey (WebAuthn)
// ---------------------------------------------------------------------------

export interface BackupPasskeyBeginResponse {
  sessionId: string;
  options: CredentialCreateOptions;
}

export interface BackupPasskeyCompleteRequest {
  sessionId: string;
  attestation: AuthenticatorAttestationRawResponse;
}

// ---------------------------------------------------------------------------
// Restore – Passkey (WebAuthn)
// ---------------------------------------------------------------------------

export interface RestorePasskeyBeginResponse {
  sessionId: string;
  options: AssertionOptions;
}

export interface RestorePasskeyCompleteRequest {
  sessionId: string;
  assertion: AuthenticatorAssertionRawResponse;
}

export interface RestorePasskeyCompleteResponse {
  walletId: string;
  name: string;
  primaryKey: string;
  secondaryKey: string;
}

// ---------------------------------------------------------------------------
// WebAuthn server-side types (JSON shapes returned/accepted by the API)
// ---------------------------------------------------------------------------

export interface CredentialCreateOptions {
  rp: { id: string; name: string; icon?: string | null };
  user: { name: string | null; id: string | null; displayName: string | null };
  challenge: string;
  pubKeyCredParams: { type: string; alg: number }[];
  timeout?: number;
  attestation?: string;
  authenticatorSelection?: {
    authenticatorAttachment?: string;
    residentKey?: string;
    requireResidentKey?: boolean;
    userVerification?: string;
  } | null;
  excludeCredentials?: { type: string; id: string; transports?: string[] | null }[];
  extensions?: Record<string, unknown> | null;
}

export interface AssertionOptions {
  challenge: string | null;
  timeout?: number;
  rpId?: string | null;
  allowCredentials?: { type: string; id: string; transports?: string[] | null }[];
  userVerification?: string | null;
  extensions?: Record<string, unknown> | null;
}

export interface AuthenticatorAttestationRawResponse {
  id: string | null;
  rawId: string | null;
  type: string;
  response: {
    attestationObject: string | null;
    clientDataJSON: string | null;
    transports: string[] | null;
  } | null;
  clientExtensionResults: Record<string, unknown>;
  extensions?: Record<string, unknown> | null;
}

export interface AuthenticatorAssertionRawResponse {
  id: string | null;
  rawId: string | null;
  type: string;
  response?: {
    authenticatorData: string;
    signature: string;
    clientDataJSON: string;
    userHandle?: string | null;
  } | null;
  clientExtensionResults: Record<string, unknown>;
  extensions?: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// SSE invoice events
// ---------------------------------------------------------------------------

export interface InvoiceEvent {
  event: "settled" | "expired";
  data: InvoiceResponse;
}

// ---------------------------------------------------------------------------
// Client configuration
// ---------------------------------------------------------------------------

export interface LnBotConfig {
  /** Base URL of the LnBot API (defaults to "https://api.ln.bot") */
  baseUrl?: string;
  /** API key for authentication (not required for wallet creation or restore) */
  apiKey?: string;
  /** Custom fetch implementation (defaults to globalThis.fetch) */
  fetch?: typeof globalThis.fetch;
}
