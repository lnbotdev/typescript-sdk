/**
 * Integration tests for @lnbot/sdk
 *
 * Requires env vars:
 *   LNBOT_USER_KEY   — user key (uk_...) that owns the prefunded wallet
 *   LNBOT_WALLET_ID  — wallet ID (wal_...) of the prefunded wallet
 *
 * Run: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { LnBot, BadRequestError } from "../src/index.js";
import type {
  CreateWalletResponse,
  WalletKeyResponse,
  AddressResponse,
  InvoiceResponse,
  PaymentResponse,
} from "../src/index.js";

const USER_KEY = process.env.LNBOT_USER_KEY;
const WALLET_ID = process.env.LNBOT_WALLET_ID;

/** Poll until payment settles or fails (max ~10s) */
async function waitForPayment(wallet: ReturnType<LnBot["wallet"]>, paymentNumber: number) {
  for (let i = 0; i < 20; i++) {
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
    let w2Info: CreateWalletResponse;
    let w2Key: WalletKeyResponse;
    let w2Client: LnBot;
    let w2Address: AddressResponse;
    let w2Invoice: InvoiceResponse;
    let w1Payment: PaymentResponse;

    // -----------------------------------------------------------------------
    // Setup: create second wallet + key
    // -----------------------------------------------------------------------

    beforeAll(async () => {
      w2Info = await client.wallets.create();
      w2Key = await client.wallet(w2Info.walletId).key.create();
      w2Client = new LnBot({ apiKey: w2Key.key });
    }, 30_000);

    // -----------------------------------------------------------------------
    // Cleanup: return funds via user key
    // -----------------------------------------------------------------------

    afterAll(async () => {
      try {
        const w2 = client.wallet(w2Info.walletId);
        const balance = await w2.get();
        if (balance.available > 0) {
          const returnInvoice = await w1.invoices.create({ amount: balance.available });
          const p = await w2.payments.create({ target: returnInvoice.bolt11 });
          await waitForPayment(w2, p.number);
        }
      } catch {
        // best-effort cleanup
      }
    }, 60_000);

    // -----------------------------------------------------------------------
    // Account
    // -----------------------------------------------------------------------

    it("me() returns identity", async () => {
      const me = await client.me();
      expect(me).toBeDefined();
    });

    // -----------------------------------------------------------------------
    // Wallets
    // -----------------------------------------------------------------------

    it("wallets.list() includes both wallets", async () => {
      const wallets = await client.wallets.list();
      const ids = wallets.map((w) => w.walletId);
      expect(ids).toContain(WALLET_ID);
      expect(ids).toContain(w2Info.walletId);
    });

    it("wallet.get() returns balance info", async () => {
      const info = await w1.get();
      expect(info.walletId).toBe(WALLET_ID);
      expect(info.balance).toBeGreaterThan(0);
      expect(info.available).toBeGreaterThanOrEqual(0);
      expect(typeof info.onHold).toBe("number");
    });

    it("wallet.update() changes name", async () => {
      const name = `test-${Date.now()}`;
      const updated = await w1.update({ name });
      expect(updated.name).toBe(name);
    });

    // -----------------------------------------------------------------------
    // Wallet key (on wallet 2)
    // -----------------------------------------------------------------------

    it("wallet.key.get() returns key metadata", async () => {
      const info = await client.wallet(w2Info.walletId).key.get();
      expect(info.hint).toBeDefined();
      expect(info.createdAt).toBeDefined();
    });

    it("wallet.key.rotate() returns new key", async () => {
      const rotated = await client.wallet(w2Info.walletId).key.rotate();
      expect(rotated.key).toBeDefined();
      expect(rotated.key).not.toBe(w2Key.key);
      // Update client with new key
      w2Key = rotated;
      w2Client = new LnBot({ apiKey: w2Key.key });
    });

    // -----------------------------------------------------------------------
    // Wallet-key auth (wallet 2 via "current")
    // -----------------------------------------------------------------------

    it("wallet('current').get() works with wallet key", async () => {
      const w2 = w2Client.wallet("current");
      const info = await w2.get();
      expect(info.walletId).toBe(w2Info.walletId);
    });

    // -----------------------------------------------------------------------
    // Addresses (on wallet 2)
    // -----------------------------------------------------------------------

    it("addresses.create() creates random address", async () => {
      const w2 = client.wallet(w2Info.walletId);
      w2Address = await w2.addresses.create();
      expect(w2Address.address).toContain("@");
      expect(w2Address.generated).toBe(true);
    });

    it("addresses.list() includes created address", async () => {
      const w2 = client.wallet(w2Info.walletId);
      const addresses = await w2.addresses.list();
      expect(addresses.map((a) => a.address)).toContain(w2Address.address);
    });

    // -----------------------------------------------------------------------
    // Invoices (on wallet 2 — create invoice to receive from wallet 1)
    // -----------------------------------------------------------------------

    it("invoices.create() creates BOLT11 invoice", async () => {
      const w2 = client.wallet(w2Info.walletId);
      w2Invoice = await w2.invoices.create({ amount: 2, memo: "sdk-test" });
      expect(w2Invoice.number).toBeGreaterThan(0);
      expect(w2Invoice.status).toBe("pending");
      expect(w2Invoice.bolt11).toMatch(/^lnbc/);
      expect(w2Invoice.amount).toBe(2);
    });

    it("invoices.list() includes created invoice", async () => {
      const w2 = client.wallet(w2Info.walletId);
      const invoices = await w2.invoices.list({ limit: 5 });
      expect(invoices.some((i) => i.number === w2Invoice.number)).toBe(true);
    });

    it("invoices.get() by number", async () => {
      const w2 = client.wallet(w2Info.walletId);
      const inv = await w2.invoices.get(w2Invoice.number);
      expect(inv.number).toBe(w2Invoice.number);
      expect(inv.amount).toBe(2);
    });

    // -----------------------------------------------------------------------
    // Public invoices (no auth needed)
    // -----------------------------------------------------------------------

    it("invoices.createForWallet() creates invoice without auth", async () => {
      const noAuth = new LnBot();
      const inv = await noAuth.invoices.createForWallet({
        walletId: w2Info.walletId,
        amount: 5,
      });
      expect(inv.bolt11).toMatch(/^lnbc/);
      expect(inv.amount).toBe(5);
    });

    it("invoices.createForAddress() creates invoice without auth", async () => {
      const noAuth = new LnBot();
      const inv = await noAuth.invoices.createForAddress({
        address: w2Address.address,
        amount: 5,
      });
      expect(inv.bolt11).toMatch(/^lnbc/);
      expect(inv.amount).toBe(5);
    });

    // -----------------------------------------------------------------------
    // Payments (wallet 1 → wallet 2)
    // -----------------------------------------------------------------------

    it("payments.resolve() inspects target", async () => {
      const resolved = await w1.payments.resolve({ target: w2Address.address });
      expect(resolved.type).toBe("lightning_address");
    });

    it("payments.create() pays invoice and settles", async () => {
      w1Payment = await w1.payments.create({ target: w2Invoice.bolt11 });
      expect(w1Payment.number).toBeGreaterThan(0);
      expect(w1Payment.amount).toBe(2);

      // Wait for settlement
      const settled = await waitForPayment(w1, w1Payment.number);
      expect(settled.status).toBe("settled");
      w1Payment = settled;
    }, 30_000);

    it("payments.list() includes payment", async () => {
      const payments = await w1.payments.list({ limit: 5 });
      expect(payments.some((p) => p.number === w1Payment.number)).toBe(true);
    });

    it("payments.get() by number", async () => {
      const payment = await w1.payments.get(w1Payment.number);
      expect(payment.number).toBe(w1Payment.number);
    });

    // -----------------------------------------------------------------------
    // Invoice settled on receiving side
    // -----------------------------------------------------------------------

    it("invoice is settled on wallet 2", async () => {
      const w2 = client.wallet(w2Info.walletId);
      const inv = await w2.invoices.get(w2Invoice.number);
      expect(inv.status).toBe("settled");
    });

    // -----------------------------------------------------------------------
    // Transactions
    // -----------------------------------------------------------------------

    it("transactions.list() returns entries", async () => {
      const txns = await w1.transactions.list({ limit: 5 });
      expect(txns.length).toBeGreaterThan(0);
      expect(txns[0]).toHaveProperty("number");
      expect(txns[0]).toHaveProperty("type");
      expect(txns[0]).toHaveProperty("amount");
      expect(txns[0]).toHaveProperty("balanceAfter");
    });

    // -----------------------------------------------------------------------
    // Webhooks (on wallet 2)
    // -----------------------------------------------------------------------

    it("webhooks CRUD", async () => {
      const w2 = client.wallet(w2Info.walletId);

      // Create
      const created = await w2.webhooks.create({ url: "https://example.com/hook" });
      expect(created.id).toBeDefined();
      expect(created.secret).toBeDefined();
      expect(created.url).toBe("https://example.com/hook");

      // List
      const list = await w2.webhooks.list();
      expect(list.some((wh) => wh.id === created.id)).toBe(true);

      // Delete
      await w2.webhooks.delete(created.id);
      const listAfter = await w2.webhooks.list();
      expect(listAfter.some((wh) => wh.id === created.id)).toBe(false);
    });

    // -----------------------------------------------------------------------
    // L402 (on wallet 1)
    // -----------------------------------------------------------------------

    it("l402.createChallenge() returns challenge", async () => {
      const challenge = await w1.l402.createChallenge({ amount: 1 });
      expect(challenge.macaroon).toBeDefined();
      expect(challenge.invoice).toMatch(/^lnbc/);
      expect(challenge.paymentHash).toBeDefined();
      expect(challenge.wwwAuthenticate).toContain("L402");
    });

    it("l402.verify() rejects invalid token", async () => {
      await expect(
        w1.l402.verify({ authorization: "L402 invalid:invalid" }),
      ).rejects.toThrow(BadRequestError);
    });

    // -----------------------------------------------------------------------
    // SSE: invoice.watch
    // Requires wallet key + explicit wallet ID (SSE doesn't work with
    // user keys, and /v1/wallets/current/* sub-routes return 404)
    // -----------------------------------------------------------------------

    it("invoices.watch() yields settlement event", async () => {
      // Create invoice via user key
      const w2 = client.wallet(w2Info.walletId);
      const inv = await w2.invoices.create({ amount: 1, memo: "watch-test" });

      // Watch via wallet key + explicit wallet ID (SSE requires wk_ auth)
      const w2wk = w2Client.wallet(w2Info.walletId);
      const events: Array<{ event: string }> = [];
      const watchPromise = (async () => {
        for await (const evt of w2wk.invoices.watch(inv.number, 60)) {
          events.push(evt);
          if (evt.event === "settled" || evt.event === "expired") break;
        }
      })();

      await new Promise((r) => setTimeout(r, 1500));

      // Pay from wallet 1
      await w1.payments.create({ target: inv.bolt11 });

      await watchPromise;
      expect(events.some((e) => e.event === "settled")).toBe(true);
    }, 60_000);

    // -----------------------------------------------------------------------
    // Return funds: wallet 2 → wallet 1 (use user key)
    // -----------------------------------------------------------------------

    it("return funds to wallet 1", async () => {
      const w2 = client.wallet(w2Info.walletId);
      const w2Balance = await w2.get();

      if (w2Balance.available > 0) {
        const returnInvoice = await w1.invoices.create({ amount: w2Balance.available });
        const p = await w2.payments.create({ target: returnInvoice.bolt11 });
        const settled = await waitForPayment(w2, p.number);
        expect(settled.status).toBe("settled");
      }
    }, 30_000);

    // -----------------------------------------------------------------------
    // Cleanup: delete address then wallet key
    // -----------------------------------------------------------------------

    it("addresses.delete() removes address", async () => {
      const w2 = client.wallet(w2Info.walletId);
      await w2.addresses.delete(w2Address.address);
      const addresses = await w2.addresses.list();
      expect(addresses.map((a) => a.address)).not.toContain(w2Address.address);
    });

    it("wallet.key.delete() revokes key", async () => {
      await client.wallet(w2Info.walletId).key.delete();
      // Wallet key should no longer work
      const deadClient = new LnBot({ apiKey: w2Key.key });
      await expect(deadClient.wallet("current").get()).rejects.toThrow();
    });
  });
}
