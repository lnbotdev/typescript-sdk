# @lnbot/sdk

[![npm version](https://img.shields.io/npm/v/@lnbot/sdk)](https://www.npmjs.com/package/@lnbot/sdk)
[![npm downloads](https://img.shields.io/npm/dm/@lnbot/sdk)](https://www.npmjs.com/package/@lnbot/sdk)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@lnbot/sdk)](https://bundlephobia.com/package/@lnbot/sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

**The official TypeScript SDK for [LnBot](https://ln.bot)** — Bitcoin for AI Agents.

Give your AI agents, apps, and services access to Bitcoin over the Lightning Network. Create wallets, send and receive sats, and get real-time payment notifications — all in a few lines of code.

```typescript
import { LnBot } from "@lnbot/sdk";

const ln = new LnBot({ apiKey: "lnbot_..." });

await ln.payments.create({ target: "alice@ln.bot", amount: 1000 });
```

> LnBot also ships a **[CLI](https://ln.bot/docs)** and **[MCP server](https://ln.bot/docs)** for agents that speak Model Context Protocol. Use whichever interface fits your stack.

---

## Why LnBot?

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
- **Idiomatic** — resource-based API (`ln.invoices.create()`, not `createInvoice()`)

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

### 1. Create a wallet

No API key needed — create a wallet and get your keys:

```typescript
import { LnBot } from "@lnbot/sdk";

const ln = new LnBot();
const wallet = await ln.wallets.create({ name: "my-agent" });

console.log(wallet.primaryKey);         // your API key
console.log(wallet.address);            // your Lightning address
console.log(wallet.recoveryPassphrase); // back this up!
```

### 2. Receive sats

```typescript
const ln = new LnBot({ apiKey: wallet.primaryKey });

const invoice = await ln.invoices.create({
  amount: 1000,
  memo: "Payment for task #42",
});

console.log(invoice.bolt11); // share with the payer
```

### 3. Wait for payment

```typescript
for await (const event of ln.invoices.waitForSettlement(invoice.number)) {
  if (event.event === "settled") {
    console.log("Paid!");
  }
}
```

### 4. Send sats

```typescript
// To a Lightning address
await ln.payments.create({
  target: "alice@ln.bot",
  amount: 500,
});

// To a BOLT11 invoice
await ln.payments.create({
  target: "lnbc10u1p...",
});
```

### 5. Check balance

```typescript
const wallet = await ln.wallets.current();
console.log(`${wallet.available} sats available`);
```

---

## Addresses

Every wallet gets a Lightning address. Create more or claim vanity addresses:

```typescript
const random = await ln.addresses.create();
const vanity = await ln.addresses.create({ address: "myagent" });
const all    = await ln.addresses.list();

await ln.addresses.delete("myagent");

await ln.addresses.transfer("myagent", {
  targetWalletKey: "other-wallet-api-key",
});
```

## Transactions

Full history of credits and debits:

```typescript
const txs = await ln.transactions.list({ limit: 20 });

for (const tx of txs) {
  console.log(`${tx.type} ${tx.amount} sats — ${tx.note}`);
}
```

## Webhooks

Get notified when invoices are paid:

```typescript
const hook = await ln.webhooks.create({
  url: "https://example.com/webhooks/lnbot",
});
// hook.secret — save this for signature verification. Only returned once.

const hooks = await ln.webhooks.list();
await ln.webhooks.delete(hook.id);
```

## API keys

Each wallet has a primary and secondary key for zero-downtime rotation:

```typescript
const keys = await ln.keys.list();
const rotated = await ln.keys.rotate(0); // 0 = primary, 1 = secondary
// rotated.key — new plaintext key, shown once
```

## Backup & restore

### Recovery passphrase

```typescript
const backup = await ln.backup.recovery();
// backup.passphrase — 12-word BIP-39, show once

const restored = await ln.restore.recovery({
  passphrase: "word1 word2 ... word12",
});
// restored.primaryKey, restored.secondaryKey — fresh keys
```

### Passkey (WebAuthn)

```typescript
const begin = await ln.backup.passkeyBegin();
// pass begin.options to navigator.credentials.create()

await ln.backup.passkeyComplete({
  sessionId: begin.sessionId,
  attestation: credential,
});
```

---

## Pagination

All list endpoints support cursor-based pagination:

```typescript
const page1 = await ln.invoices.list({ limit: 10 });

const page2 = await ln.invoices.list({
  limit: 10,
  after: page1[page1.length - 1].number,
});
```

Works the same for `ln.payments.list()` and `ln.transactions.list()`.

## Error handling

All API errors throw typed exceptions:

```typescript
import {
  LnBotError,
  BadRequestError,
  NotFoundError,
  ConflictError,
} from "@lnbot/sdk";

try {
  await ln.payments.create({ target: "invalid", amount: 100 });
} catch (err) {
  if (err instanceof BadRequestError) {
    // 400 — validation failed
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

const ln = new LnBot({
  apiKey: "lnbot_...",              // optional — not needed for wallet creation or restore
  baseUrl: "https://api.ln.bot",   // optional — this is the default
  fetch: customFetch,              // optional — bring your own fetch for testing or proxies
});
```

---

## API reference

### Wallets

| Method | Description |
| --- | --- |
| `ln.wallets.create(req?)` | Create a new wallet (no auth required) |
| `ln.wallets.current()` | Get current wallet info and balance |
| `ln.wallets.update(req)` | Update wallet name |

### Invoices

| Method | Description |
| --- | --- |
| `ln.invoices.create(req)` | Create a BOLT11 invoice to receive sats |
| `ln.invoices.list(params?)` | List invoices |
| `ln.invoices.get(number)` | Get invoice by number |
| `ln.invoices.waitForSettlement(number, timeout?, signal?)` | SSE stream — yields when invoice settles or expires |

### Payments

| Method | Description |
| --- | --- |
| `ln.payments.create(req)` | Send sats to a Lightning address or BOLT11 invoice |
| `ln.payments.list(params?)` | List payments |
| `ln.payments.get(number)` | Get payment by number |

### Addresses

| Method | Description |
| --- | --- |
| `ln.addresses.create(req?)` | Create a random or vanity Lightning address |
| `ln.addresses.list()` | List all addresses |
| `ln.addresses.delete(address)` | Delete an address |
| `ln.addresses.transfer(address, req)` | Transfer address to another wallet |

### Transactions

| Method | Description |
| --- | --- |
| `ln.transactions.list(params?)` | List credit and debit transactions |

### Webhooks

| Method | Description |
| --- | --- |
| `ln.webhooks.create(req)` | Register a webhook endpoint (max 10) |
| `ln.webhooks.list()` | List all webhooks |
| `ln.webhooks.delete(id)` | Delete a webhook |

### API Keys

| Method | Description |
| --- | --- |
| `ln.keys.list()` | List API keys (metadata only) |
| `ln.keys.rotate(slot)` | Rotate a key (0 = primary, 1 = secondary) |

### Backup

| Method | Description |
| --- | --- |
| `ln.backup.recovery()` | Generate 12-word BIP-39 recovery passphrase |
| `ln.backup.passkeyBegin()` | Start passkey backup (WebAuthn) |
| `ln.backup.passkeyComplete(req)` | Complete passkey backup |

### Restore

| Method | Description |
| --- | --- |
| `ln.restore.recovery(req)` | Restore wallet with recovery passphrase |
| `ln.restore.passkeyBegin()` | Start passkey restore (WebAuthn) |
| `ln.restore.passkeyComplete(req)` | Complete passkey restore |

---

## Requirements

- **Node.js 18+**, Bun, Deno, or any environment with a global `fetch`
- Get your API key at [ln.bot](https://ln.bot)

## Other interfaces

LnBot isn't just an SDK — pick the interface that fits your stack:

- **[CLI](https://ln.bot/docs)** — `lnbot pay lnbc1...f3q --amount 1000`
- **[MCP Server](https://ln.bot/docs)** — Model Context Protocol for AI agents
- **[REST API](https://ln.bot/docs)** — direct HTTP calls

## Links

- [ln.bot](https://ln.bot) — website
- [Documentation](https://ln.bot/docs)
- [GitHub](https://github.com/lnbotdev)
- [npm](https://www.npmjs.com/package/@lnbot/sdk)

## License

MIT
