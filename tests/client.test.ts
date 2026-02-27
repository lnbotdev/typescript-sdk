import { describe, it, expect } from "vitest";
import {
  LnBot,
  LnBotError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "../src/index.js";
import { mockFetch, mockTextFetch, createClient } from "./helpers.js";

describe("LnBot constructor", () => {
  it("defaults baseUrl to https://api.ln.bot", () => {
    const mock = mockFetch({ walletId: "wal_1" });
    const client = new LnBot({ fetch: mock.fetch });
    client.wallets.current();
    expect(mock.captured().url).toBe("https://api.ln.bot/v1/wallets/current");
  });

  it("strips trailing slash from baseUrl", () => {
    const mock = mockFetch({ walletId: "wal_1" });
    const client = new LnBot({ baseUrl: "https://custom.api.com/", fetch: mock.fetch });
    client.wallets.current();
    expect(mock.captured().url).toBe("https://custom.api.com/v1/wallets/current");
  });

  it("initializes all resource namespaces", () => {
    const client = new LnBot({ fetch: mockFetch({}).fetch });
    expect(client.wallets).toBeDefined();
    expect(client.keys).toBeDefined();
    expect(client.invoices).toBeDefined();
    expect(client.payments).toBeDefined();
    expect(client.addresses).toBeDefined();
    expect(client.transactions).toBeDefined();
    expect(client.webhooks).toBeDefined();
    expect(client.events).toBeDefined();
    expect(client.backup).toBeDefined();
    expect(client.restore).toBeDefined();
    expect(client.l402).toBeDefined();
  });
});

describe("request headers", () => {
  it("sends Authorization header when apiKey is set", async () => {
    const { client, captured } = createClient({ walletId: "wal_1" });
    await client.wallets.current();
    expect(captured().headers["Authorization"]).toBe("Bearer key_test");
  });

  it("omits Authorization header when apiKey is not set", async () => {
    const mock = mockFetch({ walletId: "wal_1" });
    const client = new LnBot({ fetch: mock.fetch });
    await client.wallets.current();
    expect(mock.captured().headers["Authorization"]).toBeUndefined();
  });

  it("sends Accept: application/json", async () => {
    const { client, captured } = createClient({ walletId: "wal_1" });
    await client.wallets.current();
    expect(captured().headers["Accept"]).toBe("application/json");
  });

  it("sends Content-Type for POST with body", async () => {
    const { client, captured } = createClient({ number: 1 });
    await client.invoices.create({ amount: 100 });
    expect(captured().headers["Content-Type"]).toBe("application/json");
  });

  it("omits Content-Type for GET", async () => {
    const { client, captured } = createClient([]);
    await client.invoices.list();
    expect(captured().headers["Content-Type"]).toBeUndefined();
  });

  it("omits Content-Type for POST without body", async () => {
    const { client, captured } = createClient({ key: "k" });
    await client.keys.rotate(0);
    expect(captured().headers["Content-Type"]).toBeUndefined();
  });
});

describe("request body serialization", () => {
  it("serializes body as JSON", async () => {
    const { client, captured } = createClient({ number: 1 });
    await client.invoices.create({ amount: 100, memo: "test" });
    expect(captured().body).toEqual({ amount: 100, memo: "test" });
  });

  it("sends no body for GET requests", async () => {
    const { client, captured } = createClient([]);
    await client.invoices.list();
    expect(captured().body).toBeUndefined();
  });
});

describe("response handling", () => {
  it("parses JSON responses", async () => {
    const { client } = createClient({ walletId: "wal_123", name: "My Wallet", balance: 1000, onHold: 0, available: 1000 });
    const wallet = await client.wallets.current();
    expect(wallet.walletId).toBe("wal_123");
    expect(wallet.balance).toBe(1000);
  });

  it("returns undefined for 204 No Content", async () => {
    const { client } = createClient(null, 204);
    const result = await client.addresses.delete("test@ln.bot");
    expect(result).toBeUndefined();
  });

  it("returns text for non-JSON content type", async () => {
    const mock = mockTextFetch("plain text response");
    const client = new LnBot({ apiKey: "key_test", fetch: mock.fetch });
    const result = await client.wallets.current();
    expect(result).toBe("plain text response");
  });
});

describe("error mapping", () => {
  it("throws BadRequestError for 400", async () => {
    const { client } = createClient({ message: "invalid" }, 400);
    await expect(client.wallets.current()).rejects.toThrow(BadRequestError);
  });

  it("throws UnauthorizedError for 401", async () => {
    const { client } = createClient({ message: "bad key" }, 401);
    await expect(client.wallets.current()).rejects.toThrow(UnauthorizedError);
  });

  it("throws ForbiddenError for 403", async () => {
    const { client } = createClient({ message: "denied" }, 403);
    await expect(client.wallets.current()).rejects.toThrow(ForbiddenError);
  });

  it("throws NotFoundError for 404", async () => {
    const { client } = createClient({ message: "not found" }, 404);
    await expect(client.wallets.current()).rejects.toThrow(NotFoundError);
  });

  it("throws ConflictError for 409", async () => {
    const { client } = createClient({ message: "conflict" }, 409);
    await expect(client.wallets.current()).rejects.toThrow(ConflictError);
  });

  it("throws LnBotError for other status codes", async () => {
    const { client } = createClient({ message: "server error" }, 500);
    await expect(client.wallets.current()).rejects.toThrow(LnBotError);
  });

  it("includes body in error", async () => {
    const { client } = createClient({ message: "invalid amount" }, 400);
    try {
      await client.wallets.current();
    } catch (e) {
      expect((e as BadRequestError).body).toContain("invalid amount");
      expect((e as BadRequestError).status).toBe(400);
    }
  });
});

describe("HTTP methods", () => {
  it("uses GET for get operations", async () => {
    const { client, captured } = createClient({ walletId: "wal_1" });
    await client.wallets.current();
    expect(captured().method).toBe("GET");
  });

  it("uses POST for create operations", async () => {
    const { client, captured } = createClient({ number: 1 });
    await client.invoices.create({ amount: 100 });
    expect(captured().method).toBe("POST");
  });

  it("uses PATCH for update operations", async () => {
    const { client, captured } = createClient({ walletId: "wal_1" });
    await client.wallets.update({ name: "New Name" });
    expect(captured().method).toBe("PATCH");
  });

  it("uses DELETE for delete operations", async () => {
    const { client, captured } = createClient(null, 204);
    await client.webhooks.delete("wh_123");
    expect(captured().method).toBe("DELETE");
  });
});
