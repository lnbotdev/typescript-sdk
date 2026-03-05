# @lnbot/sdk

[![npm version](https://img.shields.io/npm/v/@lnbot/sdk)](https://www.npmjs.com/package/@lnbot/sdk)
[![npm downloads](https://img.shields.io/npm/dm/@lnbot/sdk)](https://www.npmjs.com/package/@lnbot/sdk)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@lnbot/sdk)](https://bundlephobia.com/package/@lnbot/sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

**The official TypeScript SDK for [ln.bot](https://ln.bot)** — Bitcoin for AI Agents.

Give your AI agents, apps, and services access to Bitcoin over the Lightning Network. Create wallets, send and receive sats, and get real-time payment notifications — all in a few lines of code.

```typescript
import { LnBot } from "@lnbot/sdk";

const client = new LnBot({ apiKey: "uk_..." });
const wallet = client.wallet("wal_...");

await wallet.payments.create({ target: "alice@ln.bot", amount: 1000 });
```

> ln.bot also ships a **[Python SDK](https://pypi.org/project/lnbot/)**, **[Go SDK](https://pkg.go.dev/github.com/lnbotdev/go-sdk)**, **[Rust SDK](https://crates.io/crates/lnbot)**, **[CLI](https://ln.bot/docs)**, and **[MCP server](https://ln.bot/docs)**.

---

## Why ln.bot?

- **Built for agents** — programmatic wallets, API keys, and idempotent payments designed for autonomous software
- **Instant settlement** — payments arrive in seconds, not days
- **Lightning addresses** — human-readable addresses like `name@ln.bot`
- **Real-time events** — SSE streams and webhooks for payment notifications
- **Recovery built in** — 12-word BIP-39 passphrase and passkey backup
- **Simple pricing** — no monthly fees, pay only when you move sats off-network

## Why this SDK?

- **Zero dependencies** — native `fetch` (Node 18+, Bun, Deno, browsers)
- **Fully typed** — every request, response, and error has TypeScript types
- **Tiny** — under 10 KB minified + gzipped
- **Dual format** — ESM + CJS with source maps and `.d.ts` declarations
- **Wallet-scoped** — `client.wallet("wal_...").invoices.create()` — clean, explicit, no ambiguity

---

## Install

```bash
npm install @lnbot/sdk
```

```bash
pnpm add @lnbot/sdk
```

```bash
yarn add @lnbot/sdk
```

---

## Quick start

### 1. Register and create a wallet

```typescript
import { LnBot } from "@lnbot/sdk";

// Register a new account (no auth needed)
const client = new LnBot();
const account = await client.register();

console.log(account.primaryKey);         // user key (uk_...)
console.log(account.recoveryPassphrase); // back this up!

// Create a wallet using your user key
const authed = new LnBot({ apiKey: account.primaryKey });
const wallet = await authed.wallets.create();

console.log(wallet.walletId); // wal_...
console.log(wallet.address);  // your Lightning address
```

### 2. Receive sats

```typescript
const client = new LnBot({ apiKey: "uk_..." });
const w = client.wallet("wal_...");

const invoice = await w.invoices.create({
  amount: 1000,
  memo: "Payment for task #42",
});

console.log(invoice.bolt11); // share with the payer
```

### 3. Wait for payment (SSE)

```typescript
// SSE requires a wallet key (wk_...)
const wkClient = new LnBot({ apiKey: "wk_..." });
const w = wkClient.wallet("wal_...");

for await (const event of w.invoices.watch(invoice.number)) {
  if (event.event === "settled") {
    console.log("Paid!", event.data.preimage);
    break;
  }
}
```

### 4. Send sats

```typescript
const w = client.wallet("wal_...");

// To a Lightning address
await w.payments.create({ target: "alice@ln.bot", amount: 500 });

// To a BOLT11 invoice
await w.payments.create({ target: "lnbc10u1p..." });
```

### 5. Check balance

```typescript
const info = await client.wallet("wal_...").get();
console.log(`${info.available} sats available`);
```

---

## Authentication

ln.bot uses two key types:

- **User key** (`uk_...`) — manages all wallets under your account. Use for creating wallets, listing wallets, rotating user keys.
- **Wallet key** (`wk_...`) — scoped to a single wallet. Use for SSE streams, or to give a service access to one wallet only.

```typescript
// User key — full account access
const client = new LnBot({ apiKey: "uk_..." });
const w1 = client.wallet("wal_abc");
const w2 = client.wallet("wal_xyz");

// Wallet key — single wallet
const wkClient = new LnBot({ apiKey: "wk_..." });
const w = wkClient.wallet("current"); // "current" resolves to the key's wallet
```

### Wallet keys

```typescript
const w = client.wallet("wal_...");

// Create (one key per wallet)
const key = await w.key.create();
console.log(key.key); // wk_... — shown once

// Get metadata
const info = await w.key.get();

// Rotate (old key invalidated immediately)
const rotated = await w.key.rotate();

// Delete
await w.key.delete();
```

---

## Addresses

Every wallet gets a Lightning address on creation. Create more or claim vanity addresses:

```typescript
const w = client.wallet("wal_...");

const random = await w.addresses.create();
const vanity = await w.addresses.create({ address: "myagent" });
const all    = await w.addresses.list();

await w.addresses.delete("myagent@ln.bot");

// Transfer a vanity address to another wallet
await w.addresses.transfer("myagent@ln.bot", {
  targetWalletKey: "wk_other_wallet_key",
});
```

## Transactions

Full history of credits and debits:

```typescript
const txs = await client.wallet("wal_...").transactions.list({ limit: 20 });

for (const tx of txs) {
  console.log(`${tx.type} ${tx.amount} sats — balance: ${tx.balanceAfter}`);
}
```

## Webhooks

Get notified when invoices are paid:

```typescript
const w = client.wallet("wal_...");

const hook = await w.webhooks.create({
  url: "https://example.com/webhooks/lnbot",
});
// hook.secret — save this for signature verification. Only returned once.

const hooks = await w.webhooks.list();
await w.webhooks.delete(hook.id);
```

## Public invoices (no auth)

Create invoices for any wallet or address without authentication:

```typescript
const client = new LnBot(); // no API key needed

const inv = await client.invoices.createForWallet({
  walletId: "wal_...",
  amount: 100,
});

const inv2 = await client.invoices.createForAddress({
  address: "alice@ln.bot",
  amount: 100,
});
```

## User keys

```typescript
const rotated = await client.keys.rotate(0); // 0 = primary, 1 = secondary
// rotated.key — new plaintext key, shown once
```

## Backup & restore

### Recovery passphrase

```typescript
const backup = await client.backup.recovery();
// backup.passphrase — 12-word BIP-39, shown once

const restored = await client.restore.recovery({
  passphrase: "word1 word2 ... word12",
});
// restored.primaryKey, restored.secondaryKey — fresh keys
```

### Passkey (WebAuthn)

```typescript
const begin = await client.backup.passkeyBegin();
// pass begin.options to navigator.credentials.create()

await client.backup.passkeyComplete({
  sessionId: begin.sessionId,
  attestation: credential,
});
```

---

## L402 paywalls

Monetize APIs with Lightning-native authentication:

```typescript
const w = client.wallet("wal_...");

// Create a challenge (server side)
const challenge = await w.l402.createChallenge({
  amount: 100,
  description: "API access",
  expirySeconds: 3600,
});

// Pay the challenge (client side)
const other = otherClient.wallet("wal_...");
const result = await other.l402.pay({
  wwwAuthenticate: challenge.wwwAuthenticate,
});

// Verify a token (server side, stateless)
const { valid } = await w.l402.verify({
  authorization: result.authorization!,
});
```

## SSE event streams

### Watch a single invoice

```typescript
for await (const event of w.invoices.watch(invoiceNumber, 120)) {
  // event.event: "pending" | "settled" | "expired"
  // event.data: InvoiceResponse
}
```

### Watch a single payment

```typescript
for await (const event of w.payments.watch(paymentNumber, 60)) {
  // event.event: "processing" | "settled" | "failed"
  // event.data: PaymentResponse
}
```

### Stream all wallet events

```typescript
const controller = new AbortController();

for await (const event of w.events.stream(controller.signal)) {
  // event.event: "invoice.created" | "invoice.settled" | "payment.created" | ...
  console.log(event.event, event.data);
}
```

> SSE streams require wallet key (`wk_...`) authentication.

## Pagination

All list endpoints support cursor-based pagination:

```typescript
const page1 = await w.invoices.list({ limit: 10 });

const page2 = await w.invoices.list({
  limit: 10,
  after: page1[page1.length - 1].number,
});
```

Works the same for `w.payments.list()` and `w.transactions.list()`.

## Error handling

All API errors throw typed exceptions:

```typescript
import {
  LnBotError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "@lnbot/sdk";

try {
  await w.payments.create({ target: "invalid", amount: 100 });
} catch (err) {
  if (err instanceof BadRequestError) {
    // 400 — validation failed
  } else if (err instanceof UnauthorizedError) {
    // 401 — invalid or missing API key
  } else if (err instanceof ForbiddenError) {
    // 403 — key doesn't have access
  } else if (err instanceof NotFoundError) {
    // 404 — resource not found
  } else if (err instanceof ConflictError) {
    // 409 — duplicate or conflict
  } else if (err instanceof LnBotError) {
    // Other API error
    console.error(err.status, err.body);
  }
}
```

## Configuration

```typescript
import { LnBot } from "@lnbot/sdk";

const client = new LnBot({
  apiKey: "uk_...",                  // optional — not needed for register or public invoices
  baseUrl: "https://api.ln.bot",     // optional — this is the default
  fetch: customFetch,                // optional — bring your own fetch for testing or proxies
});
```

---

## API reference

### Top-level

| Method | Description |
| --- | --- |
| `client.register()` | Create a new account (no auth) |
| `client.me()` | Get current identity |
| `client.wallet(id)` | Get a wallet handle for scoped operations |
| `client.wallets.create()` | Create a new wallet (user key) |
| `client.wallets.list()` | List all wallets (user key) |
| `client.keys.rotate(slot)` | Rotate user key (0 = primary, 1 = secondary) |
| `client.invoices.createForWallet(req)` | Create invoice by wallet ID (no auth) |
| `client.invoices.createForAddress(req)` | Create invoice by Lightning address (no auth) |
| `client.backup.recovery()` | Generate 12-word recovery passphrase |
| `client.restore.recovery(req)` | Restore with recovery passphrase |

### Wallet-scoped (`client.wallet("wal_...")`)

| Method | Description |
| --- | --- |
| `w.get()` | Get wallet info and balance |
| `w.update(req)` | Update wallet name |

### Wallet key (`w.key`)

| Method | Description |
| --- | --- |
| `w.key.create()` | Create wallet key (max 1 per wallet) |
| `w.key.get()` | Get key metadata |
| `w.key.rotate()` | Rotate key (old key invalidated) |
| `w.key.delete()` | Delete/revoke key |

### Invoices (`w.invoices`)

| Method | Description |
| --- | --- |
| `w.invoices.create(req)` | Create a BOLT11 invoice |
| `w.invoices.list(params?)` | List invoices |
| `w.invoices.get(numberOrHash)` | Get invoice by number or payment hash |
| `w.invoices.watch(numberOrHash, timeout?)` | SSE stream for invoice status |

### Payments (`w.payments`)

| Method | Description |
| --- | --- |
| `w.payments.create(req)` | Send sats to address or invoice |
| `w.payments.list(params?)` | List payments |
| `w.payments.get(numberOrHash)` | Get payment by number or hash |
| `w.payments.resolve(params)` | Inspect a target without sending |
| `w.payments.watch(numberOrHash, timeout?)` | SSE stream for payment status |

### Addresses (`w.addresses`)

| Method | Description |
| --- | --- |
| `w.addresses.create(req?)` | Create random or vanity address |
| `w.addresses.list()` | List all addresses |
| `w.addresses.delete(address)` | Delete an address |
| `w.addresses.transfer(address, req)` | Transfer vanity address to another wallet |

### Transactions (`w.transactions`)

| Method | Description |
| --- | --- |
| `w.transactions.list(params?)` | List credit and debit transactions |

### Webhooks (`w.webhooks`)

| Method | Description |
| --- | --- |
| `w.webhooks.create(req)` | Register a webhook endpoint (max 10) |
| `w.webhooks.list()` | List all webhooks |
| `w.webhooks.delete(id)` | Delete a webhook |

### L402 (`w.l402`)

| Method | Description |
| --- | --- |
| `w.l402.createChallenge(req)` | Create L402 challenge (invoice + macaroon) |
| `w.l402.verify(req)` | Verify L402 authorization token |
| `w.l402.pay(req)` | Pay L402 challenge, get authorization header |

### Events (`w.events`)

| Method | Description |
| --- | --- |
| `w.events.stream(signal?)` | SSE stream of all wallet events |

---

## Requirements

- **Node.js 18+**, Bun, Deno, or any environment with a global `fetch`
- Get your API key at [ln.bot](https://ln.bot)

## Other interfaces

ln.bot isn't just an SDK — pick the interface that fits your stack:

- **[CLI](https://ln.bot/docs)** — `lnbot pay lnbc1...f3q --amount 1000`
- **[MCP Server](https://ln.bot/docs)** — Model Context Protocol for AI agents
- **[REST API](https://ln.bot/docs)** — direct HTTP calls

## Links

- [ln.bot](https://ln.bot) — website
- [Documentation](https://ln.bot/docs)
- [GitHub](https://github.com/lnbotdev)
- [npm](https://www.npmjs.com/package/@lnbot/sdk)

## Other SDKs

- [Python SDK](https://github.com/lnbotdev/python-sdk) · [pypi](https://pypi.org/project/lnbot/)
- [Go SDK](https://github.com/lnbotdev/go-sdk) · [pkg.go.dev](https://pkg.go.dev/github.com/lnbotdev/go-sdk)
- [Rust SDK](https://github.com/lnbotdev/rust-sdk) · [crates.io](https://crates.io/crates/lnbot) · [docs.rs](https://docs.rs/lnbot)

## License

MIT
