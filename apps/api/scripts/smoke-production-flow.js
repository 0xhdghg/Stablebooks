const crypto = require("node:crypto");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

async function main() {
  const config = readConfig();
  const planned = buildPlan(config);

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          baseUrl: config.baseUrl,
          hasOperatorToken: Boolean(config.operatorToken),
          hasArcWebhookSecret: Boolean(config.arcWebhookSecret),
          expectedFlow: [
            "GET /health/storage",
            "POST /invoices",
            "POST /public/invoices/:publicToken/payment-session",
            "POST /arc/webhooks/events",
            "POST /arc/webhooks/finality",
            "GET /invoices/:invoiceId",
            "GET /payments/:paymentId",
            "GET /payments/webhook-deliveries?queue=all"
          ],
          invoicePreview: planned.invoice,
          providerPreview: summarizeProviderPayload(planned.providerEvent),
          finalityPreview: planned.finality
        },
        null,
        2
      )
    );
    return;
  }

  const health = await request(config, "/health/storage");
  assert(
    health.data?.postgresBackedRuntimeReady === true,
    "Storage readiness is not postgresBackedRuntimeReady=true."
  );

  const invoice = await request(config, "/invoices", {
    method: "POST",
    auth: true,
    body: planned.invoice
  });
  assert(invoice.data?.id, "Invoice was not created.");
  assert(invoice.data?.publicToken, "Invoice publicToken is missing.");

  const session = await request(
    config,
    `/public/invoices/${invoice.data.publicToken}/payment-session`,
    { method: "POST", body: {} }
  );
  assert(session.data?.paymentId, "Payment session did not return paymentId.");

  const providerEvent = await request(config, "/arc/webhooks/events", {
    method: "POST",
    arcWebhook: true,
    body: planned.providerEvent
  });
  assertEqual(
    providerEvent.data?.providerDiagnostic?.sourceProfileMatched,
    true,
    "Provider profile was not matched."
  );
  assertEqual(
    providerEvent.data?.match?.matchResult,
    "exact",
    "Provider event did not exactly match payment."
  );

  const finality = await request(config, "/arc/webhooks/finality", {
    method: "POST",
    arcWebhook: true,
    body: planned.finality
  });
  assertEqual(
    finality.data?.payment?.status,
    "finalized",
    "Payment did not finalize."
  );

  const finalInvoice = await request(config, `/invoices/${invoice.data.id}`, {
    auth: true
  });
  assertEqual(finalInvoice.data?.status, "paid", "Invoice did not move to paid.");

  const payment = await request(config, `/payments/${session.data.paymentId}`, {
    auth: true
  });
  assertEqual(payment.data?.status, "finalized", "Payment detail is not finalized.");
  assertEqual(
    payment.data?.providerDiagnostic?.sourceProfileMatched,
    true,
    "Payment detail does not expose matched provider diagnostic."
  );

  const deliveries = await request(
    config,
    "/payments/webhook-deliveries?queue=all",
    { auth: true }
  );
  const delivery = deliveries.data?.find(
    (entry) =>
      entry.paymentId === session.data.paymentId &&
      entry.eventType === "payment.finalized"
  );
  assert(delivery, "payment.finalized webhook delivery was not created.");

  console.log(
    JSON.stringify(
      {
        ok: true,
        invoiceId: invoice.data.id,
        publicToken: invoice.data.publicToken,
        invoiceStatus: finalInvoice.data.status,
        paymentId: session.data.paymentId,
        paymentStatus: payment.data.status,
        txHash: payment.data.txHash ?? null,
        matchResult: providerEvent.data.match.matchResult,
        providerDiagnostic: payment.data.providerDiagnostic,
        webhookDeliveryStatus: delivery.status
      },
      null,
      2
    )
  );
}

function readConfig() {
  const baseUrl = requireEnv("SMOKE_API_BASE_URL").replace(/\/+$/, "");
  const chainId = readIntEnv("ARC_CHAIN_ID");
  const tokenDecimals = readIntEnv("ARC_EVENT_TOKEN_DECIMALS");
  const amountMinor = readOptionalIntEnv("SMOKE_AMOUNT_MINOR") ?? 10000;

  return {
    baseUrl,
    operatorToken: requireEnv("SMOKE_OPERATOR_TOKEN"),
    customerId: requireEnv("SMOKE_CUSTOMER_ID"),
    settlementWallet: requireEnv("SMOKE_SETTLEMENT_WALLET"),
    amountMinor,
    currency: optionalEnv("SMOKE_CURRENCY") ?? "USD",
    memo: optionalEnv("SMOKE_MEMO") ?? "Stablebooks production-like smoke",
    internalNote:
      optionalEnv("SMOKE_INTERNAL_NOTE") ??
      "Created by smoke-production-flow.js",
    dueAt:
      optionalEnv("SMOKE_DUE_AT") ??
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    arcWebhookSecret: requireEnv("ARC_WEBHOOK_SECRET"),
    chainId,
    contractAddress: requireEnv("ARC_EVENT_CONTRACT_ADDRESS"),
    eventSignature: requireEnv("ARC_EVENT_SIGNATURE"),
    tokenSymbol: requireEnv("ARC_EVENT_TOKEN_SYMBOL").toUpperCase(),
    tokenDecimals,
    txHash:
      optionalEnv("ARC_SMOKE_TX_HASH") ??
      `0x${crypto.randomBytes(32).toString("hex")}`,
    blockNumber:
      readOptionalIntEnv("ARC_SMOKE_BLOCK_NUMBER") ??
      Math.floor(Date.now() / 1000),
    confirmedAt:
      optionalEnv("ARC_SMOKE_CONFIRMED_AT") ?? new Date().toISOString(),
    from:
      optionalEnv("ARC_SMOKE_FROM") ??
      "0x6666666666666666666666666666666666666666",
    amountAtomic:
      optionalEnv("ARC_SMOKE_AMOUNT_ATOMIC") ??
      String(amountMinor * 10 ** (tokenDecimals - 2))
  };
}

function buildPlan(config) {
  const providerEvent = {
    notification: {
      blockchain: "ARC-TESTNET",
      chainId: config.chainId,
      txHash: config.txHash,
      blockHeight: config.blockNumber,
      firstConfirmDate: config.confirmedAt,
      contractAddress: config.contractAddress,
      eventSignature: config.eventSignature,
      tokenSymbol: config.tokenSymbol,
      tokenDecimals: config.tokenDecimals,
      logIndex: 0,
      topics: [
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      ],
      data: "0x",
      decoded: {
        from: config.from,
        to: config.settlementWallet,
        amount: config.amountAtomic,
        token: config.tokenSymbol,
        decimals: config.tokenDecimals,
        chainId: config.chainId
      }
    }
  };

  return {
    invoice: {
      customerId: config.customerId,
      amountMinor: config.amountMinor,
      currency: config.currency,
      dueAt: config.dueAt,
      memo: config.memo,
      internalNote: config.internalNote,
      publish: true
    },
    providerEvent,
    finality: {
      txHash: config.txHash,
      chainId: config.chainId,
      logIndex: 0,
      outcome: "finalized",
      blockNumber: config.blockNumber + 1,
      confirmedAt: new Date(Date.parse(config.confirmedAt) + 1000).toISOString(),
      settlementReference: `smoke_${crypto.randomBytes(6).toString("hex")}`
    }
  };
}

async function request(config, pathname, input = {}) {
  const response = await fetch(`${config.baseUrl}${pathname}`, {
    method: input.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(input.auth ? { Authorization: `Bearer ${config.operatorToken}` } : {}),
      ...(input.arcWebhook
        ? { "x-arc-webhook-secret": config.arcWebhookSecret }
        : {})
    },
    body: input.body ? JSON.stringify(input.body) : undefined
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${pathname}: ${JSON.stringify(payload)}`
    );
  }

  return payload;
}

function summarizeProviderPayload(payload) {
  return {
    txHash: payload.notification.txHash,
    chainId: payload.notification.chainId,
    contractAddress: payload.notification.contractAddress,
    eventSignature: payload.notification.eventSignature,
    tokenSymbol: payload.notification.tokenSymbol,
    tokenDecimals: payload.notification.tokenDecimals,
    to: payload.notification.decoded.to,
    amount: payload.notification.decoded.amount
  };
}

function requireEnv(name) {
  const value = optionalEnv(name);
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

function optionalEnv(name) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function readIntEnv(name) {
  const parsed = Number(requireEnv(name));
  if (!Number.isInteger(parsed)) {
    throw new Error(`Env var ${name} must be an integer.`);
  }

  return parsed;
}

function readOptionalIntEnv(name) {
  const value = optionalEnv(name);
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Env var ${name} must be an integer.`);
  }

  return parsed;
}

function assert(value, message) {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      `${message} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`
    );
  }
}
