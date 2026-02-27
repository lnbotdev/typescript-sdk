import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  LnBotError,
  NotFoundError,
  UnauthorizedError,
} from "./errors.js";
import type {
  AddressInvoiceResponse,
  AddressResponse,
  BackupPasskeyBeginResponse,
  BackupPasskeyCompleteRequest,
  CreateAddressRequest,
  CreateInvoiceForAddressRequest,
  CreateInvoiceForWalletRequest,
  CreateInvoiceRequest,
  CreateL402ChallengeRequest,
  CreatePaymentRequest,
  CreateWalletRequest,
  CreateWalletResponse,
  UpdateWalletRequest,
  CreateWebhookRequest,
  CreateWebhookResponse,
  InvoiceEvent,
  InvoiceResponse,
  L402ChallengeResponse,
  L402PayResponse,
  ListInvoicesParams,
  ListPaymentsParams,
  ListTransactionsParams,
  LnBotConfig,
  WalletResponse,
  PayL402Request,
  PaymentEvent,
  PaymentResponse,
  RecoveryBackupResponse,
  RecoveryRestoreRequest,
  RecoveryRestoreResponse,
  RestorePasskeyBeginResponse,
  RestorePasskeyCompleteRequest,
  RestorePasskeyCompleteResponse,
  RotateApiKeyResponse,
  TransactionResponse,
  TransferAddressRequest,
  TransferAddressResponse,
  VerifyL402Request,
  VerifyL402Response,
  WalletEvent,
  WebhookResponse,
} from "./types.js";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function qs(params: { [key: string]: unknown }): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v != null) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

type HttpClient = {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  del<T>(path: string): Promise<T>;
  raw: {
    fetch: typeof globalThis.fetch;
    baseUrl: string;
    apiKey: string | undefined;
  };
};

// ---------------------------------------------------------------------------
// Resource namespaces
// ---------------------------------------------------------------------------

export class WalletsResource {
  /** @internal */ constructor(private readonly _http: HttpClient) {}

  /** Creates a new wallet and returns API keys. No authentication required. */
  create(req?: CreateWalletRequest): Promise<CreateWalletResponse> {
    return this._http.post("/v1/wallets", req);
  }

  /** Returns the wallet ID, name, and balance of the authenticated wallet. */
  current(): Promise<WalletResponse> {
    return this._http.get("/v1/wallets/current");
  }

  /** Updates the wallet name. */
  update(req: UpdateWalletRequest): Promise<WalletResponse> {
    return this._http.patch("/v1/wallets/current", req);
  }
}

export class KeysResource {
  /** @internal */ constructor(private readonly _http: HttpClient) {}

  /**
   * Rotates the key in the given slot (0 = primary, 1 = secondary).
   * The old key is immediately invalidated.
   */
  rotate(slot: number): Promise<RotateApiKeyResponse> {
    return this._http.post(`/v1/keys/${slot}/rotate`);
  }
}

export class InvoicesResource {
  /** @internal */ constructor(private readonly _http: HttpClient) {}

  /** Creates a BOLT11 invoice to receive sats. */
  create(req: CreateInvoiceRequest): Promise<InvoiceResponse> {
    return this._http.post("/v1/invoices", req);
  }

  /** Lists invoices in reverse chronological order. */
  list(params?: ListInvoicesParams): Promise<InvoiceResponse[]> {
    return this._http.get(`/v1/invoices${qs({ ...params })}`);
  }

  /** Returns a specific invoice by number or payment hash. */
  get(numberOrHash: number | string): Promise<InvoiceResponse> {
    return this._http.get(`/v1/invoices/${encodeURIComponent(numberOrHash)}`);
  }

  /** Creates an invoice for a specific wallet by ID. No authentication required. */
  createForWallet(req: CreateInvoiceForWalletRequest): Promise<AddressInvoiceResponse> {
    return this._http.post("/v1/invoices/for-wallet", req);
  }

  /** Creates an invoice for a Lightning address. No authentication required. */
  createForAddress(req: CreateInvoiceForAddressRequest): Promise<AddressInvoiceResponse> {
    return this._http.post("/v1/invoices/for-address", req);
  }

  /**
   * Opens an SSE stream that resolves when the invoice settles or expires.
   * Returns an async iterable of events. The stream closes after the
   * terminal event.
   *
   * @param numberOrHash  Invoice number or payment hash
   * @param timeout Max wait in seconds (default 60, max 300)
   * @param signal  Optional AbortSignal
   */
  async *watch(
    numberOrHash: number | string,
    timeout?: number,
    signal?: AbortSignal,
  ): AsyncGenerator<InvoiceEvent> {
    const { fetch: _fetch, baseUrl, apiKey } = this._http.raw;
    const q = qs({ timeout });
    const headers: Record<string, string> = { Accept: "text/event-stream" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    const res = await _fetch(`${baseUrl}/v1/invoices/${encodeURIComponent(numberOrHash)}/events${q}`, {
      method: "GET",
      headers,
      signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new LnBotError(res.statusText, res.status, text);
    }

    if (!res.body) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let eventType = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop()!;

        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            const raw = line.slice(5).trim();
            if (raw && eventType) {
              try {
                const data = JSON.parse(raw) as InvoiceResponse;
                yield { event: eventType as InvoiceEvent["event"], data };
              } catch {
                // non-JSON data line (keepalive), skip
              }
              eventType = "";
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export class PaymentsResource {
  /** @internal */ constructor(private readonly _http: HttpClient) {}

  /** Sends sats to a Lightning address, LNURL, or BOLT11 invoice. */
  create(req: CreatePaymentRequest): Promise<PaymentResponse> {
    return this._http.post("/v1/payments", req);
  }

  /** Lists payments in reverse chronological order. */
  list(params?: ListPaymentsParams): Promise<PaymentResponse[]> {
    return this._http.get(`/v1/payments${qs({ ...params })}`);
  }

  /** Returns a specific payment by number or payment hash. */
  get(numberOrHash: number | string): Promise<PaymentResponse> {
    return this._http.get(`/v1/payments/${encodeURIComponent(numberOrHash)}`);
  }

  /**
   * Opens an SSE stream that resolves when the payment settles or fails.
   * Returns an async iterable of events. The stream closes after the
   * terminal event.
   *
   * @param numberOrHash  Payment number or payment hash
   * @param timeout Max wait in seconds (default 60, max 300)
   * @param signal  Optional AbortSignal
   */
  async *watch(
    numberOrHash: number | string,
    timeout?: number,
    signal?: AbortSignal,
  ): AsyncGenerator<PaymentEvent> {
    const { fetch: _fetch, baseUrl, apiKey } = this._http.raw;
    const q = qs({ timeout });
    const headers: Record<string, string> = { Accept: "text/event-stream" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    const res = await _fetch(`${baseUrl}/v1/payments/${encodeURIComponent(numberOrHash)}/events${q}`, {
      method: "GET",
      headers,
      signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new LnBotError(res.statusText, res.status, text);
    }

    if (!res.body) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let eventType = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop()!;

        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            const raw = line.slice(5).trim();
            if (raw && eventType) {
              try {
                const data = JSON.parse(raw) as PaymentResponse;
                yield { event: eventType as PaymentEvent["event"], data };
              } catch {
                // non-JSON data line (keepalive), skip
              }
              eventType = "";
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export class AddressesResource {
  /** @internal */ constructor(private readonly _http: HttpClient) {}

  /** Creates a random address or claims a vanity address. */
  create(req?: CreateAddressRequest): Promise<AddressResponse> {
    return this._http.post("/v1/addresses", req);
  }

  /** Lists all addresses belonging to the wallet. */
  list(): Promise<AddressResponse[]> {
    return this._http.get("/v1/addresses");
  }

  /** Deletes an address. No refund for vanity addresses. */
  delete(address: string): Promise<void> {
    return this._http.del(`/v1/addresses/${encodeURIComponent(address)}`);
  }

  /** Transfers an address to another wallet. */
  transfer(address: string, req: TransferAddressRequest): Promise<TransferAddressResponse> {
    return this._http.post(`/v1/addresses/${encodeURIComponent(address)}/transfer`, req);
  }
}

export class TransactionsResource {
  /** @internal */ constructor(private readonly _http: HttpClient) {}

  /** Lists credit and debit transactions in reverse chronological order. */
  list(params?: ListTransactionsParams): Promise<TransactionResponse[]> {
    return this._http.get(`/v1/transactions${qs({ ...params })}`);
  }
}

export class WebhooksResource {
  /** @internal */ constructor(private readonly _http: HttpClient) {}

  /** Registers a webhook endpoint. Max 10 per wallet. */
  create(req: CreateWebhookRequest): Promise<CreateWebhookResponse> {
    return this._http.post("/v1/webhooks", req);
  }

  /** Lists all webhook endpoints (secrets not included). */
  list(): Promise<WebhookResponse[]> {
    return this._http.get("/v1/webhooks");
  }

  /** Deletes a webhook endpoint by ID. */
  delete(id: string): Promise<void> {
    return this._http.del(`/v1/webhooks/${encodeURIComponent(id)}`);
  }
}

export class EventsResource {
  /** @internal */ constructor(private readonly _http: HttpClient) {}

  /**
   * Opens an SSE stream of all wallet events.
   * Events: invoice.created, invoice.settled, payment.created,
   * payment.settled, payment.failed.
   *
   * @param signal  Optional AbortSignal
   */
  async *stream(signal?: AbortSignal): AsyncGenerator<WalletEvent> {
    const { fetch: _fetch, baseUrl, apiKey } = this._http.raw;
    const headers: Record<string, string> = { Accept: "text/event-stream" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    const res = await _fetch(`${baseUrl}/v1/events`, {
      method: "GET",
      headers,
      signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new LnBotError(res.statusText, res.status, text);
    }

    if (!res.body) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop()!;

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw) continue;
          try {
            yield JSON.parse(raw) as WalletEvent;
          } catch {
            // non-JSON keepalive, skip
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export class BackupResource {
  /** @internal */ constructor(private readonly _http: HttpClient) {}

  /** Generates a 12-word BIP-39 recovery passphrase. */
  recovery(): Promise<RecoveryBackupResponse> {
    return this._http.post("/v1/backup/recovery");
  }

  /** Begins WebAuthn registration for passkey backup. */
  passkeyBegin(): Promise<BackupPasskeyBeginResponse> {
    return this._http.post("/v1/backup/passkey/begin");
  }

  /** Completes passkey backup with the attestation from the authenticator. */
  passkeyComplete(req: BackupPasskeyCompleteRequest): Promise<void> {
    return this._http.post("/v1/backup/passkey/complete", req);
  }
}

export class RestoreResource {
  /** @internal */ constructor(private readonly _http: HttpClient) {}

  /** Restores wallet access using a 12-word recovery passphrase. */
  recovery(req: RecoveryRestoreRequest): Promise<RecoveryRestoreResponse> {
    return this._http.post("/v1/restore/recovery", req);
  }

  /** Begins WebAuthn authentication for passkey restore. */
  passkeyBegin(): Promise<RestorePasskeyBeginResponse> {
    return this._http.post("/v1/restore/passkey/begin");
  }

  /** Completes passkey restore with the assertion from the authenticator. */
  passkeyComplete(req: RestorePasskeyCompleteRequest): Promise<RestorePasskeyCompleteResponse> {
    return this._http.post("/v1/restore/passkey/complete", req);
  }
}

export class L402Resource {
  /** @internal */ constructor(private readonly _http: HttpClient) {}

  /** Creates an L402 challenge (invoice + macaroon) for paywall authentication. */
  createChallenge(req: CreateL402ChallengeRequest): Promise<L402ChallengeResponse> {
    return this._http.post("/v1/l402/challenges", req);
  }

  /** Verifies an L402 authorization token (stateless — checks signature, preimage, and caveats). */
  verify(req: VerifyL402Request): Promise<VerifyL402Response> {
    return this._http.post("/v1/l402/verify", req);
  }

  /** Pays an L402 challenge and returns a ready-to-use Authorization header. */
  pay(req: PayL402Request): Promise<L402PayResponse> {
    return this._http.post("/v1/l402/pay", req);
  }
}

// ---------------------------------------------------------------------------
// Main client
// ---------------------------------------------------------------------------

export class LnBot {
  private readonly _http: HttpClient;

  readonly wallets: WalletsResource;
  readonly keys: KeysResource;
  readonly invoices: InvoicesResource;
  readonly payments: PaymentsResource;
  readonly addresses: AddressesResource;
  readonly transactions: TransactionsResource;
  readonly webhooks: WebhooksResource;
  readonly events: EventsResource;
  readonly backup: BackupResource;
  readonly restore: RestoreResource;
  readonly l402: L402Resource;

  constructor(config: LnBotConfig = {}) {
    const baseUrl = (config.baseUrl ?? "https://api.ln.bot").replace(/\/+$/, "");
    const apiKey = config.apiKey;
    const _fetch = config.fetch ?? globalThis.fetch.bind(globalThis);

    this._http = {
      get: <T>(path: string) => this.request<T>("GET", path),
      post: <T>(path: string, body?: unknown) => this.request<T>("POST", path, body),
      patch: <T>(path: string, body?: unknown) => this.request<T>("PATCH", path, body),
      del: <T>(path: string) => this.request<T>("DELETE", path),
      raw: { fetch: _fetch, baseUrl, apiKey },
    };

    this.wallets = new WalletsResource(this._http);
    this.keys = new KeysResource(this._http);
    this.invoices = new InvoicesResource(this._http);
    this.payments = new PaymentsResource(this._http);
    this.addresses = new AddressesResource(this._http);
    this.transactions = new TransactionsResource(this._http);
    this.webhooks = new WebhooksResource(this._http);
    this.events = new EventsResource(this._http);
    this.backup = new BackupResource(this._http);
    this.restore = new RestoreResource(this._http);
    this.l402 = new L402Resource(this._http);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const { fetch: _fetch, baseUrl, apiKey } = this._http.raw;
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const res = await _fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      switch (res.status) {
        case 400:
          throw new BadRequestError(text);
        case 401:
          throw new UnauthorizedError(text);
        case 403:
          throw new ForbiddenError(text);
        case 404:
          throw new NotFoundError(text);
        case 409:
          throw new ConflictError(text);
        default:
          throw new LnBotError(res.statusText, res.status, text);
      }
    }

    if (res.status === 204) return undefined as T;

    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) return (await res.json()) as T;
    return (await res.text()) as T;
  }
}
