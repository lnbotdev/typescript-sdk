import { describe, it, expect } from "vitest";
import { createClient } from "./helpers.js";

// ---------------------------------------------------------------------------
// Wallets
// ---------------------------------------------------------------------------

describe("wallets", () => {
  it("create posts to /v1/wallets", async () => {
    const { client, captured } = createClient({ walletId: "wal_1", primaryKey: "k1", secondaryKey: "k2" });
    await client.wallets.create({ name: "Test" });
    expect(captured().method).toBe("POST");
    expect(captured().url).toContain("/v1/wallets");
    expect(captured().body).toEqual({ name: "Test" });
  });

  it("create works without args", async () => {
    const { client, captured } = createClient({ walletId: "wal_1" });
    await client.wallets.create();
    expect(captured().body).toBeUndefined();
  });

  it("current gets /v1/wallets/current", async () => {
    const { client, captured } = createClient({ walletId: "wal_1" });
    await client.wallets.current();
    expect(captured().method).toBe("GET");
    expect(captured().url).toContain("/v1/wallets/current");
  });

  it("update patches /v1/wallets/current", async () => {
    const { client, captured } = createClient({ walletId: "wal_1" });
    await client.wallets.update({ name: "New" });
    expect(captured().method).toBe("PATCH");
    expect(captured().url).toContain("/v1/wallets/current");
    expect(captured().body).toEqual({ name: "New" });
  });
});

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

describe("keys", () => {
  it("rotate posts to /v1/keys/{slot}/rotate", async () => {
    const { client, captured } = createClient({ key: "key_new", name: "primary" });
    await client.keys.rotate(0);
    expect(captured().method).toBe("POST");
    expect(captured().url).toContain("/v1/keys/0/rotate");
  });

  it("rotate encodes slot number in path", async () => {
    const { client, captured } = createClient({ key: "key_new", name: "secondary" });
    await client.keys.rotate(1);
    expect(captured().url).toContain("/v1/keys/1/rotate");
  });
});

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

describe("invoices", () => {
  it("create posts to /v1/invoices", async () => {
    const { client, captured } = createClient({ number: 1, status: "pending", amount: 100 });
    await client.invoices.create({ amount: 100, memo: "test" });
    expect(captured().method).toBe("POST");
    expect(captured().url).toContain("/v1/invoices");
    expect(captured().body).toEqual({ amount: 100, memo: "test" });
  });

  it("list gets /v1/invoices", async () => {
    const { client, captured } = createClient([]);
    await client.invoices.list();
    expect(captured().method).toBe("GET");
    expect(captured().url).toContain("/v1/invoices");
  });

  it("list passes query params", async () => {
    const { client, captured } = createClient([]);
    await client.invoices.list({ limit: 10, after: 5 });
    expect(captured().url).toContain("limit=10");
    expect(captured().url).toContain("after=5");
  });

  it("list omits null query params", async () => {
    const { client, captured } = createClient([]);
    await client.invoices.list({ limit: 10 });
    expect(captured().url).toContain("limit=10");
    expect(captured().url).not.toContain("after");
  });

  it("get fetches by number", async () => {
    const { client, captured } = createClient({ number: 42 });
    await client.invoices.get(42);
    expect(captured().url).toContain("/v1/invoices/42");
  });

  it("get fetches by payment hash", async () => {
    const { client, captured } = createClient({ number: 1 });
    await client.invoices.get("abc123");
    expect(captured().url).toContain("/v1/invoices/abc123");
  });

  it("createForWallet posts to /v1/invoices/for-wallet", async () => {
    const { client, captured } = createClient({ bolt11: "lnbc1..." });
    await client.invoices.createForWallet({ walletId: "wal_1", amount: 50 });
    expect(captured().method).toBe("POST");
    expect(captured().url).toContain("/v1/invoices/for-wallet");
    expect(captured().body).toEqual({ walletId: "wal_1", amount: 50 });
  });

  it("createForAddress posts to /v1/invoices/for-address", async () => {
    const { client, captured } = createClient({ bolt11: "lnbc1..." });
    await client.invoices.createForAddress({ address: "user@ln.bot", amount: 50 });
    expect(captured().method).toBe("POST");
    expect(captured().url).toContain("/v1/invoices/for-address");
    expect(captured().body).toEqual({ address: "user@ln.bot", amount: 50 });
  });
});

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

describe("payments", () => {
  it("create posts to /v1/payments", async () => {
    const { client, captured } = createClient({ number: 1, status: "settled" });
    await client.payments.create({ target: "user@ln.bot", amount: 100 });
    expect(captured().method).toBe("POST");
    expect(captured().url).toContain("/v1/payments");
    expect(captured().body).toEqual({ target: "user@ln.bot", amount: 100 });
  });

  it("list gets /v1/payments", async () => {
    const { client, captured } = createClient([]);
    await client.payments.list();
    expect(captured().method).toBe("GET");
    expect(captured().url).toContain("/v1/payments");
  });

  it("list passes query params", async () => {
    const { client, captured } = createClient([]);
    await client.payments.list({ limit: 5, after: 10 });
    expect(captured().url).toContain("limit=5");
    expect(captured().url).toContain("after=10");
  });

  it("get fetches by number", async () => {
    const { client, captured } = createClient({ number: 7 });
    await client.payments.get(7);
    expect(captured().url).toContain("/v1/payments/7");
  });

  it("get fetches by payment hash", async () => {
    const { client, captured } = createClient({ number: 1 });
    await client.payments.get("hash123");
    expect(captured().url).toContain("/v1/payments/hash123");
  });
});

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

describe("addresses", () => {
  it("create posts to /v1/addresses", async () => {
    const { client, captured } = createClient({ address: "random@ln.bot", generated: true, cost: 0 });
    await client.addresses.create();
    expect(captured().method).toBe("POST");
    expect(captured().url).toContain("/v1/addresses");
  });

  it("create with vanity address", async () => {
    const { client, captured } = createClient({ address: "vanity@ln.bot", generated: false, cost: 100 });
    await client.addresses.create({ address: "vanity" });
    expect(captured().body).toEqual({ address: "vanity" });
  });

  it("list gets /v1/addresses", async () => {
    const { client, captured } = createClient([]);
    await client.addresses.list();
    expect(captured().method).toBe("GET");
    expect(captured().url).toContain("/v1/addresses");
  });

  it("delete sends DELETE to /v1/addresses/{address}", async () => {
    const { client, captured } = createClient(null, 204);
    await client.addresses.delete("test@ln.bot");
    expect(captured().method).toBe("DELETE");
    expect(captured().url).toContain("/v1/addresses/test%40ln.bot");
  });

  it("transfer posts to /v1/addresses/{address}/transfer", async () => {
    const { client, captured } = createClient({ address: "test@ln.bot", transferredTo: "wal_2" });
    await client.addresses.transfer("test@ln.bot", { targetWalletKey: "key_target" });
    expect(captured().method).toBe("POST");
    expect(captured().url).toContain("/v1/addresses/test%40ln.bot/transfer");
    expect(captured().body).toEqual({ targetWalletKey: "key_target" });
  });
});

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

describe("transactions", () => {
  it("list gets /v1/transactions", async () => {
    const { client, captured } = createClient([]);
    await client.transactions.list();
    expect(captured().method).toBe("GET");
    expect(captured().url).toContain("/v1/transactions");
  });

  it("list passes query params", async () => {
    const { client, captured } = createClient([]);
    await client.transactions.list({ limit: 20, after: 3 });
    expect(captured().url).toContain("limit=20");
    expect(captured().url).toContain("after=3");
  });
});

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

describe("webhooks", () => {
  it("create posts to /v1/webhooks", async () => {
    const { client, captured } = createClient({ id: "wh_1", url: "https://example.com/hook", secret: "sec" });
    await client.webhooks.create({ url: "https://example.com/hook" });
    expect(captured().method).toBe("POST");
    expect(captured().url).toContain("/v1/webhooks");
    expect(captured().body).toEqual({ url: "https://example.com/hook" });
  });

  it("list gets /v1/webhooks", async () => {
    const { client, captured } = createClient([]);
    await client.webhooks.list();
    expect(captured().method).toBe("GET");
    expect(captured().url).toContain("/v1/webhooks");
  });

  it("delete sends DELETE to /v1/webhooks/{id}", async () => {
    const { client, captured } = createClient(null, 204);
    await client.webhooks.delete("wh_123");
    expect(captured().method).toBe("DELETE");
    expect(captured().url).toContain("/v1/webhooks/wh_123");
  });
});

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

describe("backup", () => {
  it("recovery posts to /v1/backup/recovery", async () => {
    const { client, captured } = createClient({ passphrase: "word1 word2 word3" });
    await client.backup.recovery();
    expect(captured().method).toBe("POST");
    expect(captured().url).toContain("/v1/backup/recovery");
  });

  it("passkeyBegin posts to /v1/backup/passkey/begin", async () => {
    const { client, captured } = createClient({ sessionId: "s1", options: {} });
    await client.backup.passkeyBegin();
    expect(captured().method).toBe("POST");
    expect(captured().url).toContain("/v1/backup/passkey/begin");
  });

  it("passkeyComplete posts to /v1/backup/passkey/complete", async () => {
    const { client, captured } = createClient(null, 204);
    const req = { sessionId: "s1", attestation: { id: null, rawId: null, type: "public-key", response: null, clientExtensionResults: {} } };
    await client.backup.passkeyComplete(req as any);
    expect(captured().method).toBe("POST");
    expect(captured().url).toContain("/v1/backup/passkey/complete");
    expect(captured().body).toEqual(req);
  });
});

// ---------------------------------------------------------------------------
// Restore
// ---------------------------------------------------------------------------

describe("restore", () => {
  it("recovery posts to /v1/restore/recovery", async () => {
    const { client, captured } = createClient({ walletId: "wal_1", primaryKey: "k1", secondaryKey: "k2" });
    await client.restore.recovery({ passphrase: "word1 word2 word3" });
    expect(captured().method).toBe("POST");
    expect(captured().url).toContain("/v1/restore/recovery");
    expect(captured().body).toEqual({ passphrase: "word1 word2 word3" });
  });

  it("passkeyBegin posts to /v1/restore/passkey/begin", async () => {
    const { client, captured } = createClient({ sessionId: "s1", options: {} });
    await client.restore.passkeyBegin();
    expect(captured().method).toBe("POST");
    expect(captured().url).toContain("/v1/restore/passkey/begin");
  });

  it("passkeyComplete posts to /v1/restore/passkey/complete", async () => {
    const { client, captured } = createClient({ walletId: "wal_1", primaryKey: "k1", secondaryKey: "k2" });
    const req = { sessionId: "s1", assertion: { id: null, rawId: null, type: "public-key", clientExtensionResults: {} } };
    await client.restore.passkeyComplete(req as any);
    expect(captured().method).toBe("POST");
    expect(captured().url).toContain("/v1/restore/passkey/complete");
  });
});

// ---------------------------------------------------------------------------
// L402
// ---------------------------------------------------------------------------

describe("l402", () => {
  it("createChallenge posts to /v1/l402/challenges", async () => {
    const { client, captured } = createClient({ macaroon: "mac", invoice: "lnbc1...", paymentHash: "h", expiresAt: "2099-01-01", wwwAuthenticate: "L402 ..." });
    await client.l402.createChallenge({ amount: 10, description: "test" });
    expect(captured().method).toBe("POST");
    expect(captured().url).toContain("/v1/l402/challenges");
    expect(captured().body).toEqual({ amount: 10, description: "test" });
  });

  it("verify posts to /v1/l402/verify", async () => {
    const { client, captured } = createClient({ valid: true, paymentHash: "h", caveats: null, error: null });
    await client.l402.verify({ authorization: "L402 mac:pre" });
    expect(captured().method).toBe("POST");
    expect(captured().url).toContain("/v1/l402/verify");
    expect(captured().body).toEqual({ authorization: "L402 mac:pre" });
  });

  it("pay posts to /v1/l402/pay", async () => {
    const { client, captured } = createClient({ authorization: "L402 mac:pre", paymentHash: "h", preimage: "pre", amount: 10, fee: 0, paymentNumber: 1, status: "settled" });
    await client.l402.pay({ wwwAuthenticate: "L402 macaroon=\"mac\", invoice=\"inv\"" });
    expect(captured().method).toBe("POST");
    expect(captured().url).toContain("/v1/l402/pay");
    expect(captured().body).toEqual({ wwwAuthenticate: "L402 macaroon=\"mac\", invoice=\"inv\"" });
  });
});
