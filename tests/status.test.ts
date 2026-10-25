import { describe, it, expect } from "vitest";
import { LnBot, LnBotError, BadRequestError, TooManyRequestsError } from "../src/index.js";
import type { ServiceStatus, ServiceStatusHistory } from "../src/index.js";
import { mockFetch, createClient } from "./helpers.js";
// Live responses, saved on 2026-10-25
import liveStatus from "./fixtures/status.json";
import liveHistory24h from "./fixtures/status-history-24h.json";

/** A client with no API key, answering with `body` */
function noKeyClient(body: unknown, status = 200) {
  const mock = mockFetch(body, status);
  return { client: new LnBot({ fetch: mock.fetch }), captured: mock.captured };
}

// Fixtures from the API contract
const operational = '{"status":"operational","updatedAt":"2026-10-25T14:33:53.06+00:00","notice":null,"components":{"sending":{"status":"operational","inProgress":1,"byStage":{"in_flight":1},"longestWaitSeconds":3,"sentLastHour":42,"failedLastHour":1,"serviceFailuresLastHour":0,"medianSeconds":2.1,"p95Seconds":6.8},"receiving":{"status":"operational","creditedLastHour":97,"creditBacklog":0},"node":{"status":"operational","latencyMs":284},"webhooks":{"status":"operational","backlog":0}}}';
const outage = '{"status":"outage","updatedAt":"2026-10-25T14:33:53.06+00:00","notice":{"level":"outage","message":"Payments are paused while the node recovers.","since":"2026-10-25T14:10:00+00:00","until":null},"components":{"sending":{"status":"outage","inProgress":6,"byStage":{"queued":2,"retrying":4},"longestWaitSeconds":1260,"sentLastHour":3,"failedLastHour":5,"serviceFailuresLastHour":5,"medianSeconds":2.4,"p95Seconds":3.0},"receiving":{"status":"outage","creditedLastHour":4,"creditBacklog":0},"node":{"status":"outage","latencyMs":null},"webhooks":{"status":"operational","backlog":0}}}';
const stale = '{"status":"unknown","updatedAt":"2026-10-25T13:02:11.00+00:00","notice":null,"components":{"sending":{"status":"unknown","inProgress":0,"byStage":{},"longestWaitSeconds":null,"sentLastHour":12,"failedLastHour":0,"serviceFailuresLastHour":0,"medianSeconds":2.0,"p95Seconds":5.5},"receiving":{"status":"unknown","creditedLastHour":30,"creditBacklog":0},"node":{"status":"unknown","latencyMs":250},"webhooks":{"status":"unknown","backlog":0}}}';
const neverMeasured = '{"status":"unknown","updatedAt":null,"notice":null,"components":{"sending":{"status":"unknown","inProgress":0,"byStage":{},"longestWaitSeconds":null,"sentLastHour":0,"failedLastHour":0,"serviceFailuresLastHour":0,"medianSeconds":null,"p95Seconds":null},"receiving":{"status":"unknown","creditedLastHour":0,"creditBacklog":null},"node":{"status":"unknown","latencyMs":null},"webhooks":{"status":"unknown","backlog":null}}}';
const history90d = '{"range":"90d","bucketSeconds":86400,"from":"2026-07-27T00:00:00+00:00","to":"2026-10-25T14:35:12+00:00","summary":{"samples":2850,"uptime":{"overall":{"operational":99.123,"degraded":0,"outage":0.877},"sending":{"operational":99.123,"degraded":0,"outage":0.877},"receiving":{"operational":99.123,"degraded":0,"outage":0.877},"node":{"operational":99.123,"degraded":0,"outage":0.877},"webhooks":{"operational":100,"degraded":0,"outage":0}},"sent":2410,"failed":31,"serviceFailures":6,"credited":5012,"medianSeconds":2.2,"p95Seconds":7.9,"settleTimes":[{"upToSeconds":1,"count":70},{"upToSeconds":2,"count":1100},{"upToSeconds":3,"count":690},{"upToSeconds":5,"count":300},{"upToSeconds":10,"count":160},{"upToSeconds":20,"count":50},{"upToSeconds":30,"count":20},{"upToSeconds":60,"count":12},{"upToSeconds":120,"count":5},{"upToSeconds":300,"count":2},{"upToSeconds":600,"count":1},{"upToSeconds":null,"count":0}],"avgLatencyMs":301,"maxLatencyMs":20000},"buckets":[{"at":"2026-10-23T00:00:00+00:00","samples":1425,"overall":{"degraded":0,"outage":0},"sending":{"degraded":0,"outage":0,"sent":1200,"failed":12,"serviceFailures":1,"medianSeconds":2.2,"p95Seconds":7.5,"maxInProgress":4,"maxWaitSeconds":41},"receiving":{"degraded":0,"outage":0,"credited":2500,"maxBacklog":3},"node":{"degraded":0,"outage":0,"avgLatencyMs":290,"maxLatencyMs":1900},"webhooks":{"degraded":0,"outage":0,"maxBacklog":4}},{"at":"2026-10-24T00:00:00+00:00","samples":1425,"overall":{"degraded":0,"outage":25},"sending":{"degraded":0,"outage":25,"sent":1210,"failed":19,"serviceFailures":5,"medianSeconds":2.3,"p95Seconds":8.4,"maxInProgress":9,"maxWaitSeconds":1500},"receiving":{"degraded":0,"outage":25,"credited":2512,"maxBacklog":40},"node":{"degraded":0,"outage":25,"avgLatencyMs":312,"maxLatencyMs":20000},"webhooks":{"degraded":0,"outage":0,"maxBacklog":6}},{"at":"2026-10-25T00:00:00+00:00","samples":0,"overall":{"degraded":0,"outage":0},"sending":{"degraded":0,"outage":0,"sent":0,"failed":0,"serviceFailures":0,"medianSeconds":null,"p95Seconds":null,"maxInProgress":0,"maxWaitSeconds":null},"receiving":{"degraded":0,"outage":0,"credited":0,"maxBacklog":null},"node":{"degraded":0,"outage":0,"avgLatencyMs":null,"maxLatencyMs":null},"webhooks":{"degraded":0,"outage":0,"maxBacklog":null}}],"notices":[{"level":"outage","message":"Payments are paused while the node recovers.","since":"2026-10-24T09:05:00+00:00","until":"2026-10-24T09:32:00+00:00"},{"level":"info","message":"Payments are flowing again. We are watching it.","since":"2026-10-24T09:32:00+00:00","until":"2026-10-24T11:00:00+00:00"}]}';

const rateLimited = { error: "Too many requests. Please try again later." };

// ---------------------------------------------------------------------------
// status()
// ---------------------------------------------------------------------------

describe("status()", () => {
  it("gets /v1/status with no API key and no Authorization header", async () => {
    const { client, captured } = noKeyClient(JSON.parse(operational));
    await client.status();
    expect(captured().method).toBe("GET");
    expect(captured().url).toBe("https://api.ln.bot/v1/status");
    expect(captured().headers).not.toHaveProperty("Authorization");
  });

  it("still works with an API key", async () => {
    const { client, captured } = createClient(JSON.parse(operational));
    const s = await client.status();
    expect(s.status).toBe("operational");
    expect(captured().headers["Authorization"]).toBe("Bearer key_test");
  });

  it("parses an operational status", async () => {
    const { client } = noKeyClient(JSON.parse(operational));
    const s: ServiceStatus = await client.status();
    expect(s.status).toBe("operational");
    expect(s.updatedAt).toBe("2026-10-25T14:33:53.06+00:00");
    expect(s.notice).toBeNull();
    expect(s.components.sending).toEqual({
      status: "operational", inProgress: 1, byStage: { in_flight: 1 }, longestWaitSeconds: 3,
      sentLastHour: 42, failedLastHour: 1, serviceFailuresLastHour: 0, medianSeconds: 2.1, p95Seconds: 6.8,
    });
    expect(s.components.receiving).toEqual({ status: "operational", creditedLastHour: 97, creditBacklog: 0 });
    expect(s.components.node).toEqual({ status: "operational", latencyMs: 284 });
    expect(s.components.webhooks).toEqual({ status: "operational", backlog: 0 });
  });

  it("parses an outage with an operators' notice", async () => {
    const { client } = noKeyClient(JSON.parse(outage));
    const s = await client.status();
    expect(s.status).toBe("outage");
    expect(s.notice).toEqual({
      level: "outage",
      message: "Payments are paused while the node recovers.",
      since: "2026-10-25T14:10:00+00:00",
      until: null,
    });
    expect(s.components.sending.byStage).toEqual({ queued: 2, retrying: 4 });
    expect(s.components.sending.longestWaitSeconds).toBe(1260);
    expect(s.components.node.latencyMs).toBeNull();
  });

  it("parses a stale (unknown) status with an empty byStage", async () => {
    const { client } = noKeyClient(JSON.parse(stale));
    const s = await client.status();
    expect(s.status).toBe("unknown");
    expect(s.updatedAt).toBe("2026-10-25T13:02:11.00+00:00");
    expect(s.components.sending.byStage).toEqual({});
    expect(s.components.sending.longestWaitSeconds).toBeNull();
    expect(s.components.sending.medianSeconds).toBe(2.0);
  });

  it("parses a status that was never measured", async () => {
    const { client } = noKeyClient(JSON.parse(neverMeasured));
    const s = await client.status();
    expect(s.status).toBe("unknown");
    expect(s.updatedAt).toBeNull();
    expect(s.components.sending.medianSeconds).toBeNull();
    expect(s.components.sending.p95Seconds).toBeNull();
    expect(s.components.receiving.creditBacklog).toBeNull();
    expect(s.components.node.latencyMs).toBeNull();
    expect(s.components.webhooks.backlog).toBeNull();
  });

  it("parses the live response, with 7 fractional-second digits in updatedAt", async () => {
    const { client } = noKeyClient(liveStatus);
    const s = await client.status();
    expect(s.status).toBe("operational");
    expect(s.updatedAt).toBe("2026-10-25T17:16:11.9284738+00:00");
    expect(s.components.node.latencyMs).toBe(885);
  });

  it("passes an unknown overall status and notice level through", async () => {
    const body = JSON.parse(operational);
    body.status = "maintenance";
    body.notice = { level: "critical", message: "Planned work.", since: "2026-10-25T14:00:00+00:00", until: null };
    body.components.sending.status = "paused";
    body.components.sending.byStage = { teleporting: 2 };
    body.components.treasury = { status: "operational" };
    body.region = "eu";
    const { client } = noKeyClient(body);
    const s = await client.status();
    expect(s.status).toBe("maintenance");
    expect(s.notice?.level).toBe("critical");
    expect(s.components.sending.status).toBe("paused");
    expect(s.components.sending.byStage["teleporting"]).toBe(2);
  });

  it("throws TooManyRequestsError with the API's message on 429", async () => {
    const { client } = noKeyClient(rateLimited, 429);
    const err = await client.status().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TooManyRequestsError);
    expect(err).toBeInstanceOf(LnBotError);
    expect((err as TooManyRequestsError).status).toBe(429);
    expect((err as TooManyRequestsError).message).toBe("Too many requests. Please try again later.");
    expect((err as TooManyRequestsError).body).toBe(JSON.stringify(rateLimited));
  });
});

// ---------------------------------------------------------------------------
// statusHistory()
// ---------------------------------------------------------------------------

describe("statusHistory()", () => {
  it("gets /v1/status/history?range=24h by default, with no Authorization header", async () => {
    const { client, captured } = noKeyClient(liveHistory24h);
    await client.statusHistory();
    expect(captured().method).toBe("GET");
    expect(captured().url).toBe("https://api.ln.bot/v1/status/history?range=24h");
    expect(captured().headers).not.toHaveProperty("Authorization");
  });

  it("passes the range", async () => {
    const { client, captured } = noKeyClient(JSON.parse(history90d));
    await client.statusHistory("90d");
    expect(captured().url).toBe("https://api.ln.bot/v1/status/history?range=90d");
  });

  it("sends a range it doesn't know as is", async () => {
    const { client, captured } = noKeyClient(JSON.parse(history90d));
    await client.statusHistory("1y & more");
    expect(captured().url).toBe("https://api.ln.bot/v1/status/history?range=1y%20%26%20more");
  });

  it("parses the 90d fixture", async () => {
    const { client } = noKeyClient(JSON.parse(history90d));
    const h: ServiceStatusHistory = await client.statusHistory("90d");
    expect(h.range).toBe("90d");
    expect(h.bucketSeconds).toBe(86400);
    expect(h.from).toBe("2026-07-27T00:00:00+00:00");
    expect(h.summary.samples).toBe(2850);
    expect(h.summary.uptime.overall).toEqual({ operational: 99.123, degraded: 0, outage: 0.877 });
    expect(h.summary.uptime.webhooks.operational).toBe(100);
    expect(h.summary.settleTimes).toHaveLength(12);
    expect(h.summary.settleTimes[0]).toEqual({ upToSeconds: 1, count: 70 });
    expect(h.summary.settleTimes[11]).toEqual({ upToSeconds: null, count: 0 });
    expect(h.summary.maxLatencyMs).toBe(20000);
    expect(h.buckets).toHaveLength(3);
    expect(h.buckets[1].overall).toEqual({ degraded: 0, outage: 25 });
    expect(h.buckets[1].sending.maxWaitSeconds).toBe(1500);
    expect(h.notices).toHaveLength(2);
    expect(h.notices[0].until).toBe("2026-10-24T09:32:00+00:00");
    expect(h.notices[1].level).toBe("info");
  });

  it("parses a bucket that wasn't measured: samples 0, null percentiles and gauges", async () => {
    const { client } = noKeyClient(JSON.parse(history90d));
    const h = await client.statusHistory("90d");
    const b = h.buckets[2];
    expect(b.at).toBe("2026-10-25T00:00:00+00:00");
    expect(b.samples).toBe(0);
    expect(b.sending).toMatchObject({ sent: 0, medianSeconds: null, p95Seconds: null, maxWaitSeconds: null });
    expect(b.receiving.maxBacklog).toBeNull();
    expect(b.node).toMatchObject({ avgLatencyMs: null, maxLatencyMs: null });
    expect(b.webhooks.maxBacklog).toBeNull();
  });

  it("parses the live 24h response (289 buckets)", async () => {
    const { client } = noKeyClient(liveHistory24h);
    const h = await client.statusHistory("24h");
    expect(h.range).toBe("24h");
    expect(h.bucketSeconds).toBe(300);
    expect(h.to).toBe("2026-10-25T17:16:44.1635789+00:00");
    expect(h.buckets).toHaveLength(289);
    expect(h.notices).toEqual([]);

    const unmeasured = h.buckets.filter((b) => b.samples === 0);
    expect(unmeasured.length).toBeGreaterThan(0);
    for (const b of unmeasured) {
      expect(b.sending.medianSeconds).toBeNull();
      expect(b.node.avgLatencyMs).toBeNull();
    }

    const last = h.buckets[h.buckets.length - 1];
    expect(last.samples).toBe(1);
    expect(last.node.maxLatencyMs).toBe(885);
  });

  it("parses a summary with nothing measured", async () => {
    const body = JSON.parse(history90d);
    body.summary.samples = 0;
    for (const part of Object.keys(body.summary.uptime)) {
      body.summary.uptime[part] = { operational: null, degraded: null, outage: null };
    }
    const { client } = noKeyClient(body);
    const h = await client.statusHistory("90d");
    expect(h.summary.uptime.overall).toEqual({ operational: null, degraded: null, outage: null });
  });

  it("passes an unknown notice level through", async () => {
    const body = JSON.parse(history90d);
    body.notices[0].level = "critical";
    body.range = "1y";
    const { client } = noKeyClient(body);
    const h = await client.statusHistory("1y");
    expect(h.notices[0].level).toBe("critical");
    expect(h.range).toBe("1y");
  });

  it("throws TooManyRequestsError with the API's message on 429", async () => {
    const { client } = noKeyClient(rateLimited, 429);
    await expect(client.statusHistory()).rejects.toThrow(TooManyRequestsError);
    await expect(client.statusHistory()).rejects.toMatchObject({
      status: 429,
      message: "Too many requests. Please try again later.",
    });
  });

  it("throws BadRequestError for a range the API doesn't accept", async () => {
    const { client } = noKeyClient({ error: "range must be 24h, 7d, 30d or 90d." }, 400);
    await expect(client.statusHistory("1y")).rejects.toThrow(BadRequestError);
    await expect(client.statusHistory("1y")).rejects.toThrow("range must be 24h, 7d, 30d or 90d.");
  });
});
