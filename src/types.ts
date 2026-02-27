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
  preimage: string | null;
  txNumber: number | null;
  createdAt: string | null;
  settledAt: string | null;
  expiresAt: string | null;
}

export interface ListInvoicesParams {
  limit?: number;
  after?: number;
}

export interface CreateInvoiceForWalletRequest {
  /** Wallet ID in wal_xxx format */
  walletId: string;
  /** Amount in sats */
  amount: number;
  /** Caller-defined reference for tracking */
  reference?: string | null;
  /** Comment visible to the recipient */
  comment?: string | null;
}

export interface CreateInvoiceForAddressRequest {
  /** Lightning address (user@domain) */
  address: string;
  /** Amount in sats */
  amount: number;
  /** LNURL pay tag */
  tag?: string | null;
  /** Comment visible to the recipient */
  comment?: string | null;
}

export interface AddressInvoiceResponse {
  bolt11: string;
  amount: number;
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export interface CreatePaymentRequest {
  /** Lightning address (user@domain), LNURL, or BOLT11 invoice string */
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
  serviceFee: number;
  actualFee: number | null;
  address: string;
  reference: string | null;
  preimage: string | null;
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
// L402
// ---------------------------------------------------------------------------

export type L402PaymentStatus = "pending" | "processing" | "settled" | "failed";

export interface CreateL402ChallengeRequest {
  /** Amount in sats */
  amount: number;
  /** Description embedded in the Lightning invoice */
  description?: string | null;
  /** Token expiry in seconds (adds an expiry caveat to the macaroon) */
  expirySeconds?: number | null;
  /** Custom caveats to embed in the macaroon (key=value format, max 10) */
  caveats?: string[] | null;
}

export interface L402ChallengeResponse {
  /** Base64-encoded macaroon token */
  macaroon: string;
  /** BOLT11 Lightning invoice to be paid */
  invoice: string;
  /** Hex-encoded SHA-256 payment hash */
  paymentHash: string;
  /** When the Lightning invoice expires */
  expiresAt: string;
  /** Pre-formatted WWW-Authenticate header value */
  wwwAuthenticate: string;
}

export interface VerifyL402Request {
  /** L402 authorization token: L402 <base64_macaroon>:<hex_preimage> */
  authorization: string;
}

export interface VerifyL402Response {
  /** Whether the token is valid */
  valid: boolean;
  /** Hex-encoded payment hash extracted from the macaroon */
  paymentHash: string | null;
  /** Caveats extracted from the macaroon */
  caveats: string[] | null;
  /** Error message if validation failed */
  error: string | null;
}

export interface PayL402Request {
  /** WWW-Authenticate header value from an HTTP 402 response */
  wwwAuthenticate: string;
  /** Maximum routing fee in sats */
  maxFee?: number | null;
  /** Reference string stored with the payment */
  reference?: string | null;
  /** If true, polls for settlement before returning (default: true) */
  wait?: boolean | null;
  /** Max seconds to wait for settlement (1–120, default 60) */
  timeout?: number | null;
}

export interface L402PayResponse {
  /** Ready-to-use Authorization header value, or null if not yet settled */
  authorization: string | null;
  /** Hex-encoded SHA-256 payment hash */
  paymentHash: string;
  /** Hex-encoded preimage (proof of payment), or null if not yet settled */
  preimage: string | null;
  /** Payment amount in sats */
  amount: number;
  /** Actual routing fee in sats, or null if not yet settled */
  fee: number | null;
  /** Payment number for status polling */
  paymentNumber: number;
  /** Current payment status */
  status: L402PaymentStatus;
}

// ---------------------------------------------------------------------------
// SSE events
// ---------------------------------------------------------------------------

export interface InvoiceEvent {
  event: "settled" | "expired";
  data: InvoiceResponse;
}

export interface PaymentEvent {
  event: "settled" | "failed";
  data: PaymentResponse;
}

// ---------------------------------------------------------------------------
// Wallet event stream
// ---------------------------------------------------------------------------

export type WalletEventType =
  | "invoice.created"
  | "invoice.settled"
  | "payment.created"
  | "payment.settled"
  | "payment.failed";

export interface WalletEvent {
  event: WalletEventType;
  createdAt: string;
  data: InvoiceResponse | PaymentResponse;
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
