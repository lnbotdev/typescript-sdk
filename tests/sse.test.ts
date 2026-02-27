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
    for await (const event of client.invoices.watch(1)) {
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
    for await (const event of client.invoices.watch(1)) {
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
    for await (const event of client.invoices.watch(1)) {
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
    for await (const event of client.invoices.watch(1)) {
      events.push(event);
    }

    // The keepalive line has no event: prefix, so it's skipped
    // (data: without preceding event: is ignored because eventType is "")
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("settled");
  });

  it("builds correct URL with timeout", async () => {
    const mock = sseFetch([]);
    const client = new LnBot({ apiKey: "key_test", fetch: mock.fetch });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of client.invoices.watch(42, 120)) { /* empty */ }
    expect(mock.url()).toContain("/v1/invoices/42/events");
    expect(mock.url()).toContain("timeout=120");
  });

  it("sends correct headers", async () => {
    const mock = sseFetch([]);
    const client = new LnBot({ apiKey: "key_test", fetch: mock.fetch });
    for await (const _ of client.invoices.watch(1)) { /* empty */ }
    expect(mock.headers()["Accept"]).toBe("text/event-stream");
    expect(mock.headers()["Authorization"]).toBe("Bearer key_test");
  });

  it("throws LnBotError on non-ok response", async () => {
    const mock = sseFetch([], 401);
    const client = new LnBot({ apiKey: "bad_key", fetch: mock.fetch });

    await expect(async () => {
      for await (const _ of client.invoices.watch(1)) { /* empty */ }
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
    for await (const event of client.invoices.watch(1)) {
      events.push(event);
    }
    expect(events).toHaveLength(0);
  });

  it("encodes path parameter", async () => {
    const mock = sseFetch([]);
    const client = new LnBot({ apiKey: "key_test", fetch: mock.fetch });
    for await (const _ of client.invoices.watch("hash/special")) { /* empty */ }
    expect(mock.url()).toContain("/v1/invoices/hash%2Fspecial/events");
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
    for await (const event of client.payments.watch(1)) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("settled");
    expect(events[0].data.amount).toBe(50);
  });

  it("builds correct URL", async () => {
    const mock = sseFetch([]);
    const client = new LnBot({ apiKey: "key_test", fetch: mock.fetch });
    for await (const _ of client.payments.watch(7, 60)) { /* empty */ }
    expect(mock.url()).toContain("/v1/payments/7/events");
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
    for await (const event of client.events.stream()) {
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
    for await (const event of client.events.stream()) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("payment.settled");
  });

  it("builds correct URL", async () => {
    const mock = sseFetch([]);
    const client = new LnBot({ apiKey: "key_test", fetch: mock.fetch });
    for await (const _ of client.events.stream()) { /* empty */ }
    expect(mock.url()).toContain("/v1/events");
  });

  it("sends correct headers", async () => {
    const mock = sseFetch([]);
    const client = new LnBot({ apiKey: "key_test", fetch: mock.fetch });
    for await (const _ of client.events.stream()) { /* empty */ }
    expect(mock.headers()["Accept"]).toBe("text/event-stream");
    expect(mock.headers()["Authorization"]).toBe("Bearer key_test");
  });

  it("omits auth header when no apiKey", async () => {
    const mock = sseFetch([]);
    const client = new LnBot({ fetch: mock.fetch });
    for await (const _ of client.events.stream()) { /* empty */ }
    expect(mock.headers()["Authorization"]).toBeUndefined();
  });

  it("throws LnBotError on non-ok response", async () => {
    const mock = sseFetch([], 500);
    const client = new LnBot({ apiKey: "key_test", fetch: mock.fetch });

    await expect(async () => {
      for await (const _ of client.events.stream()) { /* empty */ }
    }).rejects.toThrow(LnBotError);
  });
});
