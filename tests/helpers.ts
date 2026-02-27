import { LnBot } from "../src/index.js";

/** Captured fetch call */
export interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

/** Creates a mock fetch that returns a JSON response and captures the request */
export function mockFetch(
  responseBody: unknown,
  status = 200,
  contentType = "application/json",
): { fetch: typeof globalThis.fetch; captured: () => CapturedRequest } {
  let captured: CapturedRequest | undefined;

  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const rawBody = init?.body as string | undefined;

    captured = {
      url,
      method,
      headers,
      body: rawBody ? JSON.parse(rawBody) : undefined,
    };

    return new Response(
      status === 204 ? null : JSON.stringify(responseBody),
      {
        status,
        statusText: status === 204 ? "No Content" : "OK",
        headers: { "Content-Type": contentType },
      },
    );
  }) as typeof globalThis.fetch;

  return {
    fetch,
    captured: () => {
      if (!captured) throw new Error("fetch was not called");
      return captured;
    },
  };
}

/** Creates a mock fetch that returns a text response */
export function mockTextFetch(
  text: string,
  status = 200,
): { fetch: typeof globalThis.fetch; captured: () => CapturedRequest } {
  let captured: CapturedRequest | undefined;

  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    captured = {
      url,
      method: init?.method ?? "GET",
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? JSON.parse(init.body as string) : undefined,
    };

    return new Response(text, {
      status,
      statusText: status === 200 ? "OK" : "Error",
      headers: { "Content-Type": "text/plain" },
    });
  }) as typeof globalThis.fetch;

  return {
    fetch,
    captured: () => {
      if (!captured) throw new Error("fetch was not called");
      return captured;
    },
  };
}

/** Creates an LnBot client with a mock fetch */
export function createClient(
  responseBody: unknown,
  status = 200,
  contentType = "application/json",
) {
  const mock = mockFetch(responseBody, status, contentType);
  const client = new LnBot({ apiKey: "key_test", fetch: mock.fetch });
  return { client, captured: mock.captured };
}
