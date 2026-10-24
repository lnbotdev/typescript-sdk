import { describe, it, expect } from "vitest";
import { LnBot, LnBotError } from "../src/index.js";

/** Creates a ReadableStream from SSE text chunks */
function sseStream(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

/** Creates a mock fetch that returns an SSE stream */
function sseFetch(chunks: string[], status = 200) {
  let capturedUrl = "";
  let capturedHeaders: Record<string, string> = {};

  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = typeof input === "string" ? input : input.toString();
    capturedHeaders = (init?.headers ?? {}) as Record<string, string>;

    if (status !== 200) {
      return new Response("error body", {
        status,
        statusText: "Error",
        headers: { "Content-Type": "text/plain" },
      });
    }

    return new Response(sseStream(...chunks), {
      status: 200,
      statusText: "OK",
      headers: { "Content-Type": "text/event-stream" },
    });
  }) as typeof globalThis.fetch;

  return { fetch, url: () => capturedUrl, headers: () => capturedHeaders };
}

// ---------------------------------------------------------------------------
// invoices.watch
// ---------------------------------------------------------------------------

describe("invoices.watch", () => {
  it("yields invoice events from SSE stream", async () => {
    const invoiceData = { number: 1, status: "settled", amount: 100, bolt11: "lnbc1..." };
    const chunks = [
      `event: settled\ndata: ${JSON.stringify(invoiceData)}\n\n`,
    ];
    const mock = sseFetch(chunks);
    const client = new LnBot({ apiKey: "key_test", fetch: mock.fetch });

    const events = [];
    for await (const event of client.wallet("wal_1").invoices.watch(1)) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("settled");
    expect(events[0].data.number).toBe(1);
    expect(events[0].data.status).toBe("settled");
  });

  it("yields multiple events", async () => {
    const inv1 = { number: 1, status: "pending", amount: 50 };
    const inv2 = { number: 1, status: "settled", amount: 50 };
    const chunks = [
      `event: pending\ndata: ${JSON.stringify(inv1)}\n\nevent: settled\ndata: ${JSON.stringify(inv2)}\n\n`,
    ];
    const mock = sseFetch(chunks);
    const client = new LnBot({ apiKey: "key_test", fetch: mock.fetch });

    const events = [];
    for await (const event of client.wallet("wal_1").invoices.watch(1)) {
      events.push(event);
    }

    expect(events).toHaveLength(2);
    expect(events[0].event).toBe("pending");
    expect(events[1].event).toBe("settled");
  });

  it("handles chunked SSE data split across reads", async () => {
    const data = { number: 1, status: "settled", amount: 100 };
    const full = `event: settled\ndata: ${JSON.stringify(data)}\n\n`;
    // Split in the middle
    const chunks = [full.slice(0, 10), full.slice(10)];
    const mock = sseFetch(chunks);
    const client = new LnBot({ apiKey: "key_test", fetch: mock.fetch });

    const events = [];
    for await (const event of client.wallet("wal_1").invoices.watch(1)) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("settled");
  });

  it("skips non-JSON data lines (keepalives)", async () => {
    const inv = { number: 1, status: "settled", amount: 100 };
    const chunks = [
      `data: keepalive\n\nevent: settled\ndata: ${JSON.stringify(inv)}\n\n`,
    ];
    const mock = sseFetch(chunks);
    const client = new LnBot({ apiKey: "key_test", fetch: mock.fetch });

    const events = [];
    for await (const event of client.wallet("wal_1").invoices.watch(1)) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("settled");
  });

  it("builds correct URL with timeout", async () => {
    const mock = sseFetch([]);
    const client = new LnBot({ apiKey: "key_test", fetch: mock.fetch });
    for await (const _ of client.wallet("wal_1").invoices.watch(42, 120)) { /* empty */ }
    expect(mock.url()).toContain("/v1/wallets/wal_1/invoices/42/events");
    expect(mock.url()).toContain("timeout=120");
  });

  it("sends correct headers", async () => {
    const mock = sseFetch([]);
    const client = new LnBot({ apiKey: "key_test", fetch: mock.fetch });
    for await (const _ of client.wallet("wal_1").invoices.watch(1)) { /* empty */ }
    expect(mock.headers()["Accept"]).toBe("text/event-stream");
    expect(mock.headers()["Authorization"]).toBe("Bearer key_test");
  });

  it("throws LnBotError on non-ok response", async () => {
    const mock = sseFetch([], 401);
    const client = new LnBot({ apiKey: "bad_key", fetch: mock.fetch });

    await expect(async () => {
      for await (const _ of client.wallet("wal_1").invoices.watch(1)) { /* empty */ }
    }).rejects.toThrow(LnBotError);
  });

  it("handles empty body gracefully", async () => {
    const fetch = (async () => {
      return new Response(null, {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "text/event-stream" },
      });
    }) as typeof globalThis.fetch;

    const client = new LnBot({ apiKey: "key_test", fetch });
    const events = [];
    for await (const event of client.wallet("wal_1").invoices.watch(1)) {
      events.push(event);
    }
    expect(events).toHaveLength(0);
  });

  it("encodes path parameter", async () => {
    const mock = sseFetch([]);
    const client = new LnBot({ apiKey: "key_test", fetch: mock.fetch });
    for await (const _ of client.wallet("wal_1").invoices.watch("hash/special")) { /* empty */ }
    expect(mock.url()).toContain("/v1/wallets/wal_1/invoices/hash%2Fspecial/events");
  });
});

// ---------------------------------------------------------------------------
// payments.watch
// ---------------------------------------------------------------------------

describe("payments.watch", () => {
  it("yields payment events from SSE stream", async () => {
    const paymentData = { number: 1, status: "settled", amount: 50 };
    const chunks = [
      `event: settled\ndata: ${JSON.stringify(paymentData)}\n\n`,
    ];
    const mock = sseFetch(chunks);
    const client = new LnBot({ apiKey: "key_test", fetch: mock.fetch });

    const events = [];
    for await (const event of client.wallet("wal_1").payments.watch(1)) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("settled");
    expect(events[0].data.amount).toBe(50);
  });

  it("builds correct URL", async () => {
    const mock = sseFetch([]);
    const client = new LnBot({ apiKey: "key_test", fetch: mock.fetch });
    for await (const _ of client.wallet("wal_1").payments.watch(7, 60)) { /* empty */ }
    expect(mock.url()).toContain("/v1/wallets/wal_1/payments/7/events");
    expect(mock.url()).toContain("timeout=60");
  });
});

// ---------------------------------------------------------------------------
// events.stream
// ---------------------------------------------------------------------------

describe("events.stream", () => {
  it("yields wallet events from SSE stream", async () => {
    const walletEvent = { event: "invoice.settled", createdAt: "2024-01-01T00:00:00Z", data: { number: 1, status: "settled", amount: 100 } };
    const chunks = [
      `data: ${JSON.stringify(walletEvent)}\n\n`,
    ];
    const mock = sseFetch(chunks);
    const client = new LnBot({ apiKey: "key_test", fetch: mock.fetch });

    const events = [];
    for await (const event of client.wallet("wal_1").events.stream()) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("invoice.settled");
  });

  it("skips non-JSON keepalive lines", async () => {
    const walletEvent = { event: "payment.settled", createdAt: "2024-01-01T00:00:00Z", data: { number: 1, status: "settled", amount: 50 } };
    const chunks = [
      `data: \n\ndata: keepalive\n\ndata: ${JSON.stringify(walletEvent)}\n\n`,
    ];
    const mock = sseFetch(chunks);
    const client = new LnBot({ apiKey: "key_test", fetch: mock.fetch });

    const events = [];
    for await (const event of client.wallet("wal_1").events.stream()) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("payment.settled");
  });

  it("builds correct URL", async () => {
    const mock = sseFetch([]);
    const client = new LnBot({ apiKey: "key_test", fetch: mock.fetch });
    for await (const _ of client.wallet("wal_1").events.stream()) { /* empty */ }
    expect(mock.url()).toContain("/v1/wallets/wal_1/events");
  });

  it("sends correct headers", async () => {
    const mock = sseFetch([]);
    const client = new LnBot({ apiKey: "key_test", fetch: mock.fetch });
    for await (const _ of client.wallet("wal_1").events.stream()) { /* empty */ }
    expect(mock.headers()["Accept"]).toBe("text/event-stream");
    expect(mock.headers()["Authorization"]).toBe("Bearer key_test");
  });

  it("omits auth header when no apiKey", async () => {
    const mock = sseFetch([]);
    const client = new LnBot({ fetch: mock.fetch });
    for await (const _ of client.wallet("wal_1").events.stream()) { /* empty */ }
    expect(mock.headers()["Authorization"]).toBeUndefined();
  });

  it("throws LnBotError on non-ok response", async () => {
    const mock = sseFetch([], 500);
    const client = new LnBot({ apiKey: "key_test", fetch: mock.fetch });

    await expect(async () => {
      for await (const _ of client.wallet("wal_1").events.stream()) { /* empty */ }
    }).rejects.toThrow(LnBotError);
  });
});

// ---------------------------------------------------------------------------
// Wire format: the API sends event payloads in snake_case
// ---------------------------------------------------------------------------

describe("snake_case event payloads", () => {
  const settledPayment = '{"number":1,"status":"settled","amount":20,"max_fee":5,"service_fee":1,"actual_fee":3,"address":"bub@bub.gg","reference":null,"preimage":"ab12","tx_number":4,"failure_reason":null,"created_at":"2026-10-24T14:50:01Z","settled_at":"2026-10-24T14:50:14Z"}';

  it("payments.watch decodes fees, tx number and timestamps", async () => {
    const mock = sseFetch([`event: settled\ndata: ${settledPayment}\n\n`]);
    const client = new LnBot({ apiKey: "key_test", fetch: mock.fetch });

    const events = [];
    for await (const event of client.wallet("wal_1").payments.watch(1)) events.push(event);

    expect(events).toHaveLength(1);
    expect(events[0].data).toMatchObject({
      amount: 20, maxFee: 5, serviceFee: 1, actualFee: 3, txNumber: 4,
      failureReason: null, settledAt: "2026-10-24T14:50:14Z",
    });
  });

  it("payments.watch decodes a failure reason", async () => {
    const failed = '{"number":2,"status":"failed","amount":500,"max_fee":20,"service_fee":2,"actual_fee":null,"address":"x@y.com","failure_reason":"Invoice expired before it could be paid."}';
    const mock = sseFetch([`event: failed\ndata: ${failed}\n\n`]);
    const client = new LnBot({ apiKey: "key_test", fetch: mock.fetch });

    const events = [];
    for await (const event of client.wallet("wal_1").payments.watch(2)) events.push(event);

    expect(events[0].event).toBe("failed");
    expect(events[0].data.failureReason).toBe("Invoice expired before it could be paid.");
  });

  it("watch yields a timeout event with the current state", async () => {
    const pending = '{"number":3,"status":"pending","amount":100,"max_fee":20,"service_fee":1,"actual_fee":null,"address":"x@y.com"}';
    const mock = sseFetch([`event: timeout\ndata: ${pending}\n\n`]);
    const client = new LnBot({ apiKey: "key_test", fetch: mock.fetch });

    const events = [];
    for await (const event of client.wallet("wal_1").payments.watch(3)) events.push(event);

    expect(events[0].event).toBe("timeout");
    expect(events[0].data).toMatchObject({ status: "pending", maxFee: 20 });
  });

  it("invoices.watch decodes tx number and timestamps", async () => {
    const invoice = '{"number":7,"status":"settled","amount":1000,"bolt11":"lnbc10u1p","reference":null,"memo":null,"preimage":"cd34","tx_number":4,"created_at":"2026-10-24T14:00:00Z","settled_at":"2026-10-24T14:01:00Z","expires_at":"2026-10-24T15:00:00Z"}';
    const mock = sseFetch([`event: settled\ndata: ${invoice}\n\n`]);
    const client = new LnBot({ apiKey: "key_test", fetch: mock.fetch });

    const events = [];
    for await (const event of client.wallet("wal_1").invoices.watch(7)) events.push(event);

    expect(events[0].data).toMatchObject({ txNumber: 4, settledAt: "2026-10-24T14:01:00Z", expiresAt: "2026-10-24T15:00:00Z" });
  });

  it("events.stream decodes the envelope and its data", async () => {
    const settled = `{"event":"payment.settled","created_at":"2026-10-24T14:50:14.123+00:00","data":${settledPayment}}`;
    const created = '{"event":"payment.created","created_at":"2026-10-24T14:50:01+00:00","data":{"number":1,"status":"pending","amount":20,"max_fee":5,"service_fee":1,"address":"bub@bub.gg","reference":null,"created_at":"2026-10-24T14:50:01Z"}}';
    const mock = sseFetch([`data: ${created}\n\ndata: ${settled}\n\n`]);
    const client = new LnBot({ apiKey: "key_test", fetch: mock.fetch });

    const events = [];
    for await (const event of client.wallet("wal_1").events.stream()) events.push(event);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ event: "payment.created", createdAt: "2026-10-24T14:50:01+00:00" });
    expect(events[0].data).toMatchObject({ status: "pending", maxFee: 5, serviceFee: 1 });
    expect(events[1].createdAt).toBe("2026-10-24T14:50:14.123+00:00");
    expect(events[1].data).toMatchObject({ actualFee: 3, serviceFee: 1, txNumber: 4 });
  });

  it("still accepts camelCase payloads", async () => {
    const mock = sseFetch([`event: settled\ndata: {"number":1,"status":"settled","amount":20,"actualFee":3,"serviceFee":1}\n\n`]);
    const client = new LnBot({ apiKey: "key_test", fetch: mock.fetch });

    const events = [];
    for await (const event of client.wallet("wal_1").payments.watch(1)) events.push(event);

    expect(events[0].data).toMatchObject({ actualFee: 3, serviceFee: 1 });
  });
});
