// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type InvoiceStatus = "pending" | "settled" | "expired";

export type PaymentStatus = "pending" | "processing" | "settled" | "failed";

/**
 * Where a payment is, more precisely than its `status`:
 *
 * | `stage` | With `status` |
 * | --- | --- |
 * | `queued` | `pending` |
 * | `retrying` | `pending` (see `retryUntil`) |
 * | `sending` | `pending` or `processing` |
 * | `in_flight` | `processing` |
 * | `confirming` | `processing` |
 * | `on_hold` | `processing` |
 * | `settled` | `settled` |
 * | `failed` | `failed` |
 *
 * Open: more stages may be added, so for one you don't know, go by `status`.
 */
export type PaymentStage =
  | "queued"
  | "retrying"
  | "sending"
  | "in_flight"
  | "confirming"
  | "on_hold"
  | "settled"
  | "failed"
  | (string & {});

export type TransactionType = "credit" | "debit";

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

export interface RegisterResponse {
  userId: string;
  primaryKey: string;
  secondaryKey: string;
  recoveryPassphrase: string;
}

export interface MeResponse {
  walletId: string;
}

// ---------------------------------------------------------------------------
// Service status
// ---------------------------------------------------------------------------

/**
 * The state of ln.bot or one of its parts. `unknown`: not measured for 5
 * minutes. Open: more values may be added, so never fail on one you don't know.
 */
export type ServiceState = "operational" | "degraded" | "outage" | "unknown" | (string & {});

/**
 * An operators' notice level: `info` (no effect on the status), `warning`
 * (the overall status is at least `degraded`) or `outage` (the overall status
 * is `outage`). Open: more values may be added.
 */
export type StatusNoticeLevel = "info" | "warning" | "outage" | (string & {});

/**
 * The range of `statusHistory()`: `24h` (5-minute buckets), `7d` (hourly),
 * `30d` (6-hourly) or `90d` (daily). Any other value is sent as is; the API
 * answers 400 to one it doesn't know.
 */
export type StatusRange = "24h" | "7d" | "30d" | "90d" | (string & {});

/** A message from the operators. */
export interface StatusNotice {
  level: StatusNoticeLevel;
  /** Up to 500 characters, to show as is */
  message: string;
  /** When it was posted */
  since: string;
  /** When it came down; null while it is still up (always null in `status()`) */
  until: string | null;
}

/** Lightning payments out. */
export interface SendingStatus {
  status: ServiceState;
  /** Payments being sent now */
  inProgress: number;
  /**
   * Those payments by stage (`queued`, `retrying`, `sending`, `in_flight`,
   * `confirming`, `on_hold`, and any added later). Stages with none are left
   * out, so it can be `{}`.
   */
  byStage: Record<string, number>;
  /** How long the oldest of them has waited, in seconds; null when none */
  longestWaitSeconds: number | null;
  /** Sent in the last hour */
  sentLastHour: number;
  /** Failed in the last hour, for any reason */
  failedLastHour: number;
  /** Of those, the ones the service caused; the rest were the invoice's or the route's */
  serviceFailuresLastHour: number;
  /** Request-to-settlement time over the last hour, median, in seconds; null when nothing was sent */
  medianSeconds: number | null;
  /** The same, 95th percentile; null when nothing was sent */
  p95Seconds: number | null;
}

/** Lightning payments in. */
export interface ReceivingStatus {
  status: ServiceState;
  /** Incoming payments credited in the last hour */
  creditedLastHour: number;
  /** Incoming payments waiting to be credited now; null when it could not be read */
  creditBacklog: number | null;
}

/** The Lightning node. */
export interface NodeStatus {
  status: ServiceState;
  /** How long the node took to answer, in milliseconds; null when it didn't answer */
  latencyMs: number | null;
}

/** Webhook delivery. */
export interface WebhooksStatus {
  status: ServiceState;
  /** Deliveries waiting to go out; null when it could not be read */
  backlog: number | null;
}

export interface StatusComponents {
  sending: SendingStatus;
  receiving: ReceivingStatus;
  node: NodeStatus;
  webhooks: WebhooksStatus;
}

/** The service right now, from `status()`. */
export interface ServiceStatus {
  /** Overall. With `unknown`, the numbers below are as old as `updatedAt`. */
  status: ServiceState;
  /** When it was measured; null if never */
  updatedAt: string | null;
  /** A message from the operators, or null */
  notice: StatusNotice | null;
  components: StatusComponents;
}

/** Percent of the measured time in each state; each is null when nothing was measured. */
export interface UptimeShare {
  operational: number | null;
  degraded: number | null;
  outage: number | null;
}

export interface StatusUptime {
  overall: UptimeShare;
  sending: UptimeShare;
  receiving: UptimeShare;
  node: UptimeShare;
  webhooks: UptimeShare;
}

/** One bar of the settlement-time histogram. */
export interface SettleTimeCount {
  /** Upper bound in seconds (1, 2, 3, 5, 10, 20, 30, 60, 120, 300, 600); null for the last entry, anything slower */
  upToSeconds: number | null;
  /** Payments that settled within it */
  count: number;
}

/** The whole range of `statusHistory()`. */
export interface StatusHistorySummary {
  /** Measurements in the range, about one a minute */
  samples: number;
  uptime: StatusUptime;
  sent: number;
  failed: number;
  /** Of the failures, the ones the service caused */
  serviceFailures: number;
  credited: number;
  /** Request-to-settlement time, median, in seconds (approximate, from `settleTimes`) */
  medianSeconds: number | null;
  /** The same, 95th percentile */
  p95Seconds: number | null;
  settleTimes: SettleTimeCount[];
  /** The node's average response time, in milliseconds */
  avgLatencyMs: number | null;
  /** The node's slowest response, in milliseconds */
  maxLatencyMs: number | null;
}

/** How many of a bucket's measurements found a part in each state; the rest found it operational. */
export interface StatusBucketCounts {
  degraded: number;
  outage: number;
}

export interface StatusBucketSending extends StatusBucketCounts {
  sent: number;
  failed: number;
  serviceFailures: number;
  medianSeconds: number | null;
  p95Seconds: number | null;
  /** Most payments in progress at once */
  maxInProgress: number | null;
  /** Longest wait of a payment in progress, in seconds */
  maxWaitSeconds: number | null;
}

export interface StatusBucketReceiving extends StatusBucketCounts {
  credited: number;
  /** Most incoming payments waiting to be credited at once */
  maxBacklog: number | null;
}

export interface StatusBucketNode extends StatusBucketCounts {
  avgLatencyMs: number | null;
  maxLatencyMs: number | null;
}

export interface StatusBucketWebhooks extends StatusBucketCounts {
  /** Most deliveries waiting at once */
  maxBacklog: number | null;
}

/**
 * One bucket of `statusHistory()`. `samples` is how many measurements it
 * holds, about one a minute; `0` means it wasn't measured (its percentiles and
 * gauges are then null): treat it as no data, not as up or down. Its uptime
 * is `(samples - degraded - outage) / samples`.
 */
export interface StatusBucket {
  /** Start of the bucket, aligned to UTC */
  at: string;
  samples: number;
  overall: StatusBucketCounts;
  sending: StatusBucketSending;
  receiving: StatusBucketReceiving;
  node: StatusBucketNode;
  webhooks: StatusBucketWebhooks;
}

/** The service over time, from `statusHistory()`. */
export interface ServiceStatusHistory {
  range: StatusRange;
  /** Bucket length in seconds: 300 (24h), 3600 (7d), 21600 (30d) or 86400 (90d) */
  bucketSeconds: number;
  /** Start of the first bucket */
  from: string;
  /** End of the range: now */
  to: string;
  summary: StatusHistorySummary;
  /**
   * Oldest first. Don't assume a count: the last bucket is still filling, so a
   * full range has one more than it spans (289 for 24h).
   */
  buckets: StatusBucket[];
  /** The operators' notices that were up during the range, oldest first */
  notices: StatusNotice[];
}

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

export interface WalletListItem {
  walletId: string;
  name: string;
  createdAt: string | null;
}

export interface CreateWalletResponse {
  walletId: string;
  name: string;
  address: string;
}

export interface UpdateWalletRequest {
  name: string;
}

// ---------------------------------------------------------------------------
// Wallet Keys
// ---------------------------------------------------------------------------

export interface WalletKeyResponse {
  key: string;
  hint: string;
}

export interface WalletKeyInfoResponse {
  hint: string;
  createdAt: string | null;
  lastUsedAt: string | null;
}

// ---------------------------------------------------------------------------
// API Keys (user-level)
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
  /**
   * Maximum network fee in sats: the Lightning routing, on top of the 0.25%
   * service fee. Defaults to 1% of the amount, minimum 20 sats; accepts 1 to
   * the larger of 10,000 and 5% of the amount. Leave it out unless you need a
   * different cap.
   */
  maxFee?: number | null;
  /** Caller-defined reference for tracking */
  reference?: string | null;
}

export interface PaymentResponse {
  number: number;
  status: PaymentStatus;
  amount: number;
  /** Network fee reserved for this payment (the estimate plus a buffer); the unused part is released at settlement */
  maxFee: number;
  /** Service fee: 0.25%, minimum 1 sat; 0 for transfers between ln.bot wallets */
  serviceFee: number;
  /** Network fee actually charged in sats: the Lightning routing (the 0.25% service fee is separate), or null until settled */
  actualFee: number | null;
  address: string;
  reference: string | null;
  preimage: string | null;
  txNumber: number | null;
  failureReason: string | null;
  createdAt: string | null;
  settledAt: string | null;
  /**
   * Where the payment is, more precisely than `status` (see {@link PaymentStage}).
   * For a stage you don't know, go by `status`. Missing from an older API.
   */
  stage?: PaymentStage;
  /**
   * A sentence to show the user as is: what is happening while the payment is
   * in progress, the `failureReason` once it failed, null once it settled.
   * Missing from an older API.
   */
  statusDetail?: string | null;
  /**
   * Only with `stage: "retrying"`: until when it is retried. If it still can't
   * be sent by then, it fails within about a minute and the funds are
   * released. Null otherwise; missing from an older API.
   */
  retryUntil?: string | null;
}

export interface ListPaymentsParams {
  limit?: number;
  after?: number;
}

export interface ResolveTargetParams {
  /** Lightning address (user@domain), LNURL, or BOLT11 invoice string */
  target: string;
  /**
   * Amount in sats to price the payment for. For a BOLT11 invoice it must
   * equal the invoice amount. Leave it out for a Lightning address or LNURL
   * to get `maxSendable` instead.
   */
  amount?: number | null;
}

export interface ResolveTargetResponse {
  type: "lightning_address" | "lnurl" | "bolt11";
  /** Minimum accepted amount in sats, or null for a BOLT11 invoice */
  min: number | null;
  /** Maximum accepted amount in sats, or null for a BOLT11 invoice */
  max: number | null;
  /** True if the recipient expects a fixed amount */
  fixed: boolean;
  /** The amount priced: the invoice amount for BOLT11, else the amount passed. Null without an amount. */
  amount: number | null;
  /** True when the recipient is an ln.bot wallet: an internal transfer with no fees */
  internal: boolean;
  /** Estimated network fee in sats: the Lightning routing. Null without an amount or an estimate; 0 if internal. */
  networkFeeEstimate: number | null;
  /** Service fee in sats: 0.25%, minimum 1 sat; 0 if internal. Null without an amount. */
  serviceFee: number | null;
  /** Network fee that would be held with the default maxFee. Null without an amount, or when `feeWarning` is set. */
  maxFee: number | null;
  /** amount + networkFeeEstimate + serviceFee. Null without an amount. */
  total: number | null;
  /** Lightning address or LNURL resolved without an amount: the most this wallet can send there now, after fees (0 if it can't cover the recipient's minimum). Null otherwise. */
  maxSendable: number | null;
  /** Set when sending without maxFee would be rejected because the fee is unusually high */
  feeWarning: string | null;
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
  /** Maximum network fee in sats: the Lightning routing, on top of the 0.25% service fee. Defaults to 1% of the amount, minimum 20 sats. */
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
  /** Network fee charged in sats: the Lightning routing (the 0.25% service fee is separate), or null if not yet settled */
  fee: number | null;
  /** Payment number for status polling */
  paymentNumber: number;
  /** Current payment status */
  status: L402PaymentStatus;
}

// ---------------------------------------------------------------------------
// SSE events
// ---------------------------------------------------------------------------

/**
 * An event from `invoices.watch()`. `timeout` means the wait ran out before the
 * invoice settled or expired: `data` is its current state; read or watch again.
 */
export interface InvoiceEvent {
  event: "settled" | "expired" | "timeout";
  data: InvoiceResponse;
}

/**
 * An event from `payments.watch()`. `timeout` means the wait ran out before the
 * payment settled or failed: `data` is its current state, with `stage`,
 * `statusDetail` and `retryUntil`; read or watch again. The stream doesn't
 * send an event for each stage change.
 */
export interface PaymentEvent {
  event: "settled" | "failed" | "timeout";
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

/**
 * An event from `events.stream()`. `data` is the invoice or payment; the
 * `*.created` events carry only the fields known at creation.
 */
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
  /** API key for authentication (not required for registration or restore) */
  apiKey?: string;
  /** Custom fetch implementation (defaults to globalThis.fetch) */
  fetch?: typeof globalThis.fetch;
}
