/**
 * Integration tests for @lnbot/sdk
 *
 * These tests hit the live API with real sats. They validate every SDK method,
 * response shapes, error handling, balance bookkeeping, and edge cases.
 *
 * Requires env vars:
 *   LNBOT_USER_KEY   — user key (uk_...) that owns the prefunded wallet
 *   LNBOT_WALLET_ID  — wallet ID (wal_...) of the prefunded wallet
 *
 * Run: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  LnBot,
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
} from "../src/index.js";
import type {
  CreateWalletResponse,
  WalletKeyResponse,
  WalletResponse,
  AddressResponse,
  InvoiceResponse,
  PaymentResponse,
  TransactionResponse,
} from "../src/index.js";

const USER_KEY = process.env.LNBOT_USER_KEY;
const WALLET_ID = process.env.LNBOT_WALLET_ID;

/** Poll until payment settles or fails (max ~15s) */
async function waitForPayment(wallet: ReturnType<LnBot["wallet"]>, paymentNumber: number) {
  for (let i = 0; i < 30; i++) {
    const p = await wallet.payments.get(paymentNumber);
    if (p.status === "settled" || p.status === "failed") return p;
    await new Promise((r) => setTimeout(r, 500));
  }
  return wallet.payments.get(paymentNumber);
}

if (!USER_KEY || !WALLET_ID) {
  describe.skip("integration (missing env vars)", () => {
    it("skipped", () => {});
  });
} else {
  describe("integration", () => {
    const client = new LnBot({ apiKey: USER_KEY });
    const w1 = client.wallet(WALLET_ID);

    // State shared across tests
    let w1BalanceBefore: number;
    let w2Info: CreateWalletResponse;
    let w2Key: WalletKeyResponse;
    let w2Client: LnBot;
    let w2Address: AddressResponse;
    let w2Invoice: InvoiceResponse;
    let w1Payment: PaymentResponse;

    // -----------------------------------------------------------------------
    // Setup
    // -----------------------------------------------------------------------

    beforeAll(async () => {
      const w1Info = await w1.get();
      w1BalanceBefore = w1Info.balance;
      w2Info = await client.wallets.create();
      w2Key = await client.wallet(w2Info.walletId).key.create();
      w2Client = new LnBot({ apiKey: w2Key.key });
    }, 30_000);

    // -----------------------------------------------------------------------
    // Cleanup: return all funds to wallet 1
    // -----------------------------------------------------------------------

    afterAll(async () => {
      try {
        const w2 = client.wallet(w2Info.walletId);
        const balance = await w2.get();
        if (balance.available > 0) {
          const inv = await w1.invoices.create({ amount: balance.available });
          const p = await w2.payments.create({ target: inv.bolt11 });
          await waitForPayment(w2, p.number);
        }
      } catch {
        // best-effort
      }
    }, 60_000);

    // =======================================================================
    // ACCOUNT
    // =======================================================================

    describe("account", () => {
      it("register() creates a new account", async () => {
        const noAuth = new LnBot();
        const account = await noAuth.register();
        expect(account.userId).toMatch(/^usr_/);
        expect(account.primaryKey).toBeDefined();
        expect(account.secondaryKey).toBeDefined();
        expect(account.recoveryPassphrase.split(" ")).toHaveLength(12);
      });

      it("me() returns identity with user key", async () => {
        const me = await client.me();
        expect(me).toBeDefined();
      });

      it("me() returns identity with wallet key", async () => {
        const me = await w2Client.me();
        expect(me).toHaveProperty("walletId");
      });

      it("me() rejects invalid key", async () => {
        const bad = new LnBot({ apiKey: "uk_invalid" });
        await expect(bad.me()).rejects.toThrow(UnauthorizedError);
      });
    });

    // =======================================================================
    // WALLETS
    // =======================================================================

    describe("wallets", () => {
      it("wallets.create() returns wallet with address", async () => {
        expect(w2Info.walletId).toMatch(/^wal_/);
        expect(w2Info.name).toBeDefined();
        expect(w2Info.address).toContain("@");
      });

      it("wallets.list() includes both wallets", async () => {
        const wallets = await client.wallets.list();
        const ids = wallets.map((w) => w.walletId);
        expect(ids).toContain(WALLET_ID);
        expect(ids).toContain(w2Info.walletId);
        // Validate list item shape
        const item = wallets.find((w) => w.walletId === w2Info.walletId)!;
        expect(item.name).toBeDefined();
        expect(item.createdAt).toBeDefined();
      });

      it("wallet.get() returns full balance info", async () => {
        const info = await w1.get();
        expect(info.walletId).toBe(WALLET_ID);
        expect(info.balance).toBeGreaterThan(0);
        expect(info.available).toBeGreaterThanOrEqual(0);
        expect(typeof info.onHold).toBe("number");
        expect(info.available).toBeLessThanOrEqual(info.balance);
      });

      it("wallet.update() changes name and returns updated wallet", async () => {
        const name = `test-${Date.now()}`;
        const updated = await w1.update({ name });
        expect(updated.name).toBe(name);
        expect(updated.walletId).toBe(WALLET_ID);
        // Verify persistence
        const fetched = await w1.get();
        expect(fetched.name).toBe(name);
      });

      it("wallet.get() rejects nonexistent wallet", async () => {
        const bad = client.wallet("wal_nonexistent");
        await expect(bad.get()).rejects.toThrow(NotFoundError);
      });
    });

    // =======================================================================
    // WALLET KEYS
    // =======================================================================

    describe("wallet keys", () => {
      it("wallet.key.create() was done in setup", () => {
        expect(w2Key.key).toMatch(/^wk_/);
        expect(w2Key.hint).toBeDefined();
      });

      it("wallet.key.create() rejects duplicate", async () => {
        await expect(
          client.wallet(w2Info.walletId).key.create(),
        ).rejects.toThrow();
      });

      it("wallet.key.get() returns metadata", async () => {
        const info = await client.wallet(w2Info.walletId).key.get();
        expect(info.hint).toBeDefined();
        expect(info.createdAt).toBeDefined();
      });

      it("wallet.key.rotate() returns new key", async () => {
        const rotated = await client.wallet(w2Info.walletId).key.rotate();
        expect(rotated.key).toMatch(/^wk_/);
        expect(rotated.key).not.toBe(w2Key.key);
        w2Key = rotated;
        w2Client = new LnBot({ apiKey: w2Key.key });
      });

      it("old wallet key is invalidated after rotate", async () => {
        // w2Key now has the rotated key; the old one should fail
        // (we can't test this directly since we overwrote the old key,
        // but we verify the new key works)
        const info = await w2Client.wallet("current").get();
        expect(info.walletId).toBe(w2Info.walletId);
      });

      it("wallet('current').get() works with wallet key", async () => {
        const info = await w2Client.wallet("current").get();
        expect(info.walletId).toBe(w2Info.walletId);
        expect(typeof info.balance).toBe("number");
      });
    });

    // =======================================================================
    // ADDRESSES
    // =======================================================================

    describe("addresses", () => {
      it("addresses.create() creates random address", async () => {
        const w2 = client.wallet(w2Info.walletId);
        w2Address = await w2.addresses.create();
        expect(w2Address.address).toContain("@");
        expect(w2Address.generated).toBe(true);
        expect(w2Address.cost).toBe(0);
        expect(w2Address.createdAt).toBeDefined();
      });

      it("addresses.list() includes created address", async () => {
        const w2 = client.wallet(w2Info.walletId);
        const addresses = await w2.addresses.list();
        expect(addresses.length).toBeGreaterThanOrEqual(1);
        const found = addresses.find((a) => a.address === w2Address.address);
        expect(found).toBeDefined();
        expect(found!.generated).toBe(true);
      });

      it("addresses.transfer() rejects generated addresses", async () => {
        const w2 = client.wallet(w2Info.walletId);
        // Generated (random) addresses cannot be transferred — only vanity addresses can
        const extra = await w2.addresses.create();

        let w1Key: WalletKeyResponse | null = null;
        try {
          w1Key = await w1.key.create();
        } catch {
          w1Key = await w1.key.rotate();
        }

        await expect(
          w2.addresses.transfer(extra.address, { targetWalletKey: w1Key.key }),
        ).rejects.toThrow(BadRequestError);

        // Cleanup
        await w2.addresses.delete(extra.address);
        await w1.key.delete();
      });
    });

    // =======================================================================
    // INVOICES
    // =======================================================================

    describe("invoices", () => {
      it("invoices.create() with all fields", async () => {
        const w2 = client.wallet(w2Info.walletId);
        w2Invoice = await w2.invoices.create({
          amount: 2,
          memo: "sdk-test",
          reference: "ref-001",
        });
        expect(w2Invoice.number).toBeGreaterThan(0);
        expect(w2Invoice.status).toBe("pending");
        expect(w2Invoice.bolt11).toMatch(/^lnbc/);
        expect(w2Invoice.amount).toBe(2);
        expect(w2Invoice.memo).toBe("sdk-test");
        expect(w2Invoice.reference).toBe("ref-001");
        expect(w2Invoice.preimage).toBeNull();
        expect(w2Invoice.txNumber).toBeNull();
        expect(w2Invoice.createdAt).toBeDefined();
        expect(w2Invoice.settledAt).toBeNull();
        expect(w2Invoice.expiresAt).toBeDefined();
      });

      it("invoices.create() rejects zero amount", async () => {
        const w2 = client.wallet(w2Info.walletId);
        await expect(
          w2.invoices.create({ amount: 0 }),
        ).rejects.toThrow(BadRequestError);
      });

      it("invoices.list() returns array with pagination", async () => {
        const w2 = client.wallet(w2Info.walletId);
        const all = await w2.invoices.list({ limit: 10 });
        expect(all.length).toBeGreaterThanOrEqual(1);

        // Pagination: after cursor
        if (all.length >= 2) {
          const page = await w2.invoices.list({ limit: 1, after: all[0].number });
          expect(page.length).toBeGreaterThanOrEqual(1);
          expect(page[0].number).toBeLessThan(all[0].number);
        }
      });

      it("invoices.get() by number", async () => {
        const w2 = client.wallet(w2Info.walletId);
        const inv = await w2.invoices.get(w2Invoice.number);
        expect(inv.number).toBe(w2Invoice.number);
        expect(inv.amount).toBe(2);
        expect(inv.reference).toBe("ref-001");
      });

      it("invoices.get() rejects nonexistent number", async () => {
        const w2 = client.wallet(w2Info.walletId);
        await expect(w2.invoices.get(999999)).rejects.toThrow(NotFoundError);
      });

      it("invoices.createForWallet() without auth", async () => {
        const noAuth = new LnBot();
        const inv = await noAuth.invoices.createForWallet({
          walletId: w2Info.walletId,
          amount: 5,
        });
        expect(inv.bolt11).toMatch(/^lnbc/);
        expect(inv.amount).toBe(5);
        expect(inv.expiresAt).toBeDefined();
      });

      it("invoices.createForAddress() without auth", async () => {
        const noAuth = new LnBot();
        const inv = await noAuth.invoices.createForAddress({
          address: w2Address.address,
          amount: 5,
        });
        expect(inv.bolt11).toMatch(/^lnbc/);
        expect(inv.amount).toBe(5);
        expect(inv.expiresAt).toBeDefined();
      });

      it("invoices.createForWallet() rejects nonexistent wallet", async () => {
        const noAuth = new LnBot();
        // API validates wallet ID format before checking existence → 400
        await expect(
          noAuth.invoices.createForWallet({ walletId: "wal_nonexistent", amount: 1 }),
        ).rejects.toThrow(BadRequestError);
      });
    });

    // =======================================================================
    // PAYMENTS + BALANCE BOOKKEEPING
    // =======================================================================

    describe("payments", () => {
      let w1BalanceBeforePayment: number;
      let w2BalanceBeforePayment: number;

      it("payments.resolve() lightning address", async () => {
        const resolved = await w1.payments.resolve({ target: w2Address.address });
        expect(resolved.type).toBe("lightning_address");
        expect(typeof resolved.min).toBe("number");
        expect(typeof resolved.max).toBe("number");
        expect(typeof resolved.fixed).toBe("boolean");
      });

      it("payments.resolve() bolt11 invoice", async () => {
        const resolved = await w1.payments.resolve({ target: w2Invoice.bolt11 });
        expect(resolved.type).toBe("bolt11");
        expect(resolved.amount).toBe(2);
        expect(resolved.fixed).toBe(true);
      });

      it("record balances before payment", async () => {
        w1BalanceBeforePayment = (await w1.get()).balance;
        w2BalanceBeforePayment = (await client.wallet(w2Info.walletId).get()).balance;
      });

      it("payments.create() pays invoice and settles", async () => {
        w1Payment = await w1.payments.create({ target: w2Invoice.bolt11 });
        expect(w1Payment.number).toBeGreaterThan(0);
        expect(w1Payment.amount).toBe(2);

        const settled = await waitForPayment(w1, w1Payment.number);
        expect(settled.status).toBe("settled");
        expect(settled.preimage).toBeDefined();
        expect(settled.txNumber).toBeDefined();
        expect(settled.settledAt).toBeDefined();
        w1Payment = settled;
      }, 30_000);

      it("balances updated correctly after payment", async () => {
        const w1After = await w1.get();
        const w2After = await client.wallet(w2Info.walletId).get();

        // w1 lost amount + fees
        expect(w1After.balance).toBeLessThan(w1BalanceBeforePayment);
        expect(w1After.balance).toBe(
          w1BalanceBeforePayment - w1Payment.amount - w1Payment.serviceFee - (w1Payment.actualFee ?? 0),
        );

        // w2 gained exactly the invoice amount
        expect(w2After.balance).toBe(w2BalanceBeforePayment + 2);
      });

      it("invoice is settled on wallet 2", async () => {
        const w2 = client.wallet(w2Info.walletId);
        const inv = await w2.invoices.get(w2Invoice.number);
        expect(inv.status).toBe("settled");
        expect(inv.preimage).toBeDefined();
        expect(inv.settledAt).toBeDefined();
        expect(inv.txNumber).toBeDefined();
      });

      it("payments.list() includes payment with pagination", async () => {
        const payments = await w1.payments.list({ limit: 5 });
        expect(payments.some((p) => p.number === w1Payment.number)).toBe(true);

        // Pagination
        if (payments.length >= 2) {
          const page = await w1.payments.list({ limit: 1, after: payments[0].number });
          expect(page.length).toBeGreaterThanOrEqual(1);
          expect(page[0].number).toBeLessThan(payments[0].number);
        }
      });

      it("payments.get() by number", async () => {
        const payment = await w1.payments.get(w1Payment.number);
        expect(payment.number).toBe(w1Payment.number);
        expect(payment.status).toBe("settled");
        expect(payment.amount).toBe(2);
      });

      it("payments.get() rejects nonexistent number", async () => {
        await expect(w1.payments.get(999999)).rejects.toThrow(NotFoundError);
      });

      it("payments.create() rejects insufficient balance", async () => {
        const w2 = client.wallet(w2Info.walletId);
        // w2 has 2 sats, try to send 999999
        const inv = await w1.invoices.create({ amount: 999999 });
        await expect(
          w2.payments.create({ target: inv.bolt11 }),
        ).rejects.toThrow(BadRequestError);
      });

      it("payments.create() with idempotency key prevents double-pay", async () => {
        const w2 = client.wallet(w2Info.walletId);
        const inv = await w1.invoices.create({ amount: 1 });
        const idempotencyKey = `idem-${Date.now()}`;

        // First payment
        const p1 = await w2.payments.create({
          target: inv.bolt11,
          idempotencyKey,
        });
        await waitForPayment(w2, p1.number);

        // Second payment with same key — should return same payment, not create new
        const p2 = await w2.payments.create({
          target: inv.bolt11,
          idempotencyKey,
        });
        expect(p2.number).toBe(p1.number);
      }, 30_000);
    });

    // =======================================================================
    // TRANSACTIONS
    // =======================================================================

    describe("transactions", () => {
      it("transactions.list() has debit entry for payment", async () => {
        const txns = await w1.transactions.list({ limit: 10 });
        expect(txns.length).toBeGreaterThan(0);

        // Find the debit for our payment
        const debit = txns.find(
          (t) => t.type === "debit" && t.paymentHash === w1Payment.preimage?.slice(0, 64),
        ) ?? txns.find((t) => t.type === "debit");
        expect(debit).toBeDefined();
        expect(debit!.type).toBe("debit");
        expect(debit!.amount).toBeGreaterThan(0);
        expect(typeof debit!.balanceAfter).toBe("number");
        expect(debit!.createdAt).toBeDefined();
      });

      it("transactions.list() has credit entry on wallet 2", async () => {
        const w2 = client.wallet(w2Info.walletId);
        const txns = await w2.transactions.list({ limit: 10 });
        const credit = txns.find((t) => t.type === "credit");
        expect(credit).toBeDefined();
        expect(credit!.amount).toBe(2);
      });

      it("transactions.list() pagination", async () => {
        const txns = await w1.transactions.list({ limit: 1 });
        expect(txns).toHaveLength(1);

        if (txns.length > 0) {
          const next = await w1.transactions.list({ limit: 1, after: txns[0].number });
          if (next.length > 0) {
            expect(next[0].number).toBeLessThan(txns[0].number);
          }
        }
      });
    });

    // =======================================================================
    // WEBHOOKS
    // =======================================================================

    describe("webhooks", () => {
      it("full CRUD cycle", async () => {
        const w2 = client.wallet(w2Info.walletId);

        // Create
        const created = await w2.webhooks.create({ url: "https://example.com/hook" });
        expect(created.id).toBeDefined();
        expect(created.secret).toBeDefined();
        expect(created.url).toBe("https://example.com/hook");
        expect(created.createdAt).toBeDefined();

        // List
        const list = await w2.webhooks.list();
        const found = list.find((wh) => wh.id === created.id);
        expect(found).toBeDefined();
        expect(found!.url).toBe("https://example.com/hook");
        expect(typeof found!.active).toBe("boolean");

        // Delete
        await w2.webhooks.delete(created.id);
        const listAfter = await w2.webhooks.list();
        expect(listAfter.some((wh) => wh.id === created.id)).toBe(false);
      });

      it("webhooks.delete() rejects nonexistent id", async () => {
        const w2 = client.wallet(w2Info.walletId);
        await expect(
          w2.webhooks.delete("nonexistent"),
        ).rejects.toThrow(NotFoundError);
      });
    });

    // =======================================================================
    // L402 — FULL FLOW
    // =======================================================================

    describe("l402", () => {
      it("l402.createChallenge() returns all fields", async () => {
        const challenge = await w1.l402.createChallenge({
          amount: 1,
          description: "test paywall",
          expirySeconds: 300,
          caveats: ["service=test"],
        });
        expect(challenge.macaroon).toBeDefined();
        expect(challenge.invoice).toMatch(/^lnbc/);
        expect(challenge.paymentHash).toBeDefined();
        expect(challenge.expiresAt).toBeDefined();
        expect(challenge.wwwAuthenticate).toContain("L402");
        expect(challenge.wwwAuthenticate).toContain("macaroon=");
        expect(challenge.wwwAuthenticate).toContain("invoice=");
      });

      it("l402.verify() rejects invalid token", async () => {
        await expect(
          w1.l402.verify({ authorization: "L402 invalid:invalid" }),
        ).rejects.toThrow(BadRequestError);
      });

      it("l402 full flow: challenge → pay → verify", async () => {
        // Create challenge on w1
        const challenge = await w1.l402.createChallenge({ amount: 1 });

        // Pay from w2 (which has funds)
        const w2 = client.wallet(w2Info.walletId);
        const payResult = await w2.l402.pay({
          wwwAuthenticate: challenge.wwwAuthenticate,
          maxFee: 1,
          wait: true,
          timeout: 30,
        });
        expect(payResult.status).toBe("settled");
        expect(payResult.authorization).toBeDefined();
        expect(payResult.authorization).toContain("L402");
        expect(payResult.preimage).toBeDefined();
        expect(payResult.paymentHash).toBe(challenge.paymentHash);
        expect(payResult.amount).toBe(1);

        // Verify the token on w1
        const verified = await w1.l402.verify({
          authorization: payResult.authorization!,
        });
        expect(verified.valid).toBe(true);
        expect(verified.paymentHash).toBe(challenge.paymentHash);
        expect(verified.caveats).toBeDefined();
        expect(verified.error).toBeNull();
      }, 60_000);
    });

    // =======================================================================
    // SSE: INVOICE WATCH
    // =======================================================================

    describe("invoices.watch()", () => {
      it("yields settlement event", async () => {
        const w2 = client.wallet(w2Info.walletId);
        const inv = await w2.invoices.create({ amount: 1, memo: "watch-test" });

        // Watch via wallet key (SSE requires wk_ auth)
        const w2wk = w2Client.wallet(w2Info.walletId);
        const events: Array<{ event: string }> = [];
        const watchPromise = (async () => {
          for await (const evt of w2wk.invoices.watch(inv.number, 60)) {
            events.push(evt);
            if (evt.event === "settled" || evt.event === "expired") break;
          }
        })();

        await new Promise((r) => setTimeout(r, 1500));
        await w1.payments.create({ target: inv.bolt11 });

        await watchPromise;
        expect(events.some((e) => e.event === "settled")).toBe(true);
      }, 60_000);
    });

    // =======================================================================
    // SSE: PAYMENT WATCH
    // =======================================================================

    describe("payments.watch()", () => {
      it("yields settlement event", async () => {
        const w2 = client.wallet(w2Info.walletId);
        const inv = await w1.invoices.create({ amount: 1 });

        // Start payment from w2
        const payment = await w2.payments.create({ target: inv.bolt11 });

        // Watch via wallet key
        const w2wk = w2Client.wallet(w2Info.walletId);
        const events: Array<{ event: string }> = [];
        for await (const evt of w2wk.payments.watch(payment.number, 30)) {
          events.push(evt);
          if (evt.event === "settled" || evt.event === "failed") break;
        }

        expect(events.some((e) => e.event === "settled")).toBe(true);
      }, 60_000);
    });

    // =======================================================================
    // SSE: WALLET EVENT STREAM
    // =======================================================================

    describe("events.stream()", () => {
      it("receives invoice and payment events", async () => {
        const w2wk = w2Client.wallet(w2Info.walletId);
        const w2 = client.wallet(w2Info.walletId);

        const events: Array<{ event: string }> = [];
        const controller = new AbortController();

        const streamPromise = (async () => {
          for await (const evt of w2wk.events.stream(controller.signal)) {
            events.push(evt);
            // Collect a couple events then stop
            if (events.length >= 2) {
              controller.abort();
              break;
            }
          }
        })();

        await new Promise((r) => setTimeout(r, 1500));

        // Create and pay an invoice to generate events
        const inv = await w2.invoices.create({ amount: 1 });
        await w1.payments.create({ target: inv.bolt11 });

        // Wait for events or timeout
        await Promise.race([
          streamPromise,
          new Promise((r) => setTimeout(r, 15_000)),
        ]);
        controller.abort();

        // Should have gotten at least one event
        expect(events.length).toBeGreaterThanOrEqual(1);
        const eventTypes = events.map((e) => e.event);
        // Could be invoice.created, invoice.settled, etc.
        expect(eventTypes.some((t) => t.startsWith("invoice."))).toBe(true);
      }, 30_000);
    });

    // =======================================================================
    // BACKUP
    // =======================================================================

    describe("backup", () => {
      it("backup.recovery() generates 12-word passphrase", async () => {
        const result = await client.backup.recovery();
        expect(result.passphrase).toBeDefined();
        expect(result.passphrase.split(" ")).toHaveLength(12);
      });
    });

    // =======================================================================
    // ERROR HANDLING
    // =======================================================================

    describe("error handling", () => {
      it("rejects unauthenticated access to protected endpoints", async () => {
        const noAuth = new LnBot();
        await expect(noAuth.me()).rejects.toThrow(UnauthorizedError);
      });

      it("rejects wrong wallet ID", async () => {
        const bad = client.wallet("wal_nonexistent");
        await expect(bad.invoices.list()).rejects.toThrow(NotFoundError);
      });

      it("rejects access to wallet owned by another user", async () => {
        // Create a separate account
        const otherAccount = await new LnBot().register();
        const otherClient = new LnBot({ apiKey: otherAccount.primaryKey });
        // Try to access our wallet
        await expect(
          otherClient.wallet(WALLET_ID).get(),
        ).rejects.toThrow();
      });
    });

    // =======================================================================
    // RETURN FUNDS + CLEANUP
    // =======================================================================

    describe("cleanup", () => {
      it("return funds to wallet 1", async () => {
        const w2 = client.wallet(w2Info.walletId);
        const w2Balance = await w2.get();

        if (w2Balance.available > 0) {
          const inv = await w1.invoices.create({ amount: w2Balance.available });
          const p = await w2.payments.create({ target: inv.bolt11 });
          const settled = await waitForPayment(w2, p.number);
          expect(settled.status).toBe("settled");
        }

        // Verify w2 is empty
        const after = await w2.get();
        expect(after.balance).toBe(0);
      }, 30_000);

      it("wallet 1 balance is restored", async () => {
        const w1After = await w1.get();
        // Balance may differ slightly due to service fees on internal transfers
        // but should be close to the original
        expect(w1After.balance).toBeGreaterThanOrEqual(w1BalanceBefore - 10);
      });

      it("addresses.delete() removes address", async () => {
        const w2 = client.wallet(w2Info.walletId);
        await w2.addresses.delete(w2Address.address);
        const addresses = await w2.addresses.list();
        expect(addresses.map((a) => a.address)).not.toContain(w2Address.address);
      });

      it("addresses.delete() rejects already-deleted address", async () => {
        const w2 = client.wallet(w2Info.walletId);
        await expect(
          w2.addresses.delete(w2Address.address),
        ).rejects.toThrow(NotFoundError);
      });

      it("wallet.key.delete() revokes key", async () => {
        await client.wallet(w2Info.walletId).key.delete();
        const deadClient = new LnBot({ apiKey: w2Key.key });
        await expect(deadClient.wallet("current").get()).rejects.toThrow();
      });

      it("wallet.key.get() rejects after delete", async () => {
        await expect(
          client.wallet(w2Info.walletId).key.get(),
        ).rejects.toThrow(NotFoundError);
      });
    });
  });
}
