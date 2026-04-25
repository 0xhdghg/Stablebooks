const { spawn } = require("node:child_process");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const apiDir = path.resolve(__dirname, "..");
const baseUrl = `http://127.0.0.1:${process.env.TEST_WEBHOOK_API_PORT || "4518"}/api/v1`;
const operatorToken = "sb_6a83a3316556e3139feb1f6833fc93e543e79e495d0ef484";
const mockChainKey = "stablebooks-dev-chain-key";
const txHash =
  "0xwebhookregression000000000000000000000000000000000000000000000001";
const notePrefix = "Webhook regression";

let apiProcess = null;

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const prisma = new PrismaClient();

  try {
    await cleanupPostgresScenario(prisma);
    apiProcess = startApi();
    await waitForApi();

    await runRetryReplayRegression();

    console.log("Webhook retry/replay regressions passed.");
  } finally {
    if (apiProcess) {
      apiProcess.kill();
    }

    await cleanupPostgresScenario(prisma).catch((error) => {
      console.warn(`Webhook regression cleanup failed: ${error.message}`);
    });
    await prisma.$disconnect();
  }
}

async function runRetryReplayRegression() {
  const scenario = await createPayableScenario({
    amountMinor: 90300,
    memo: "Webhook regression invoice",
    internalNote: `${notePrefix} retry replay`
  });

  const raw = await postMock("/payments/mock/raw-chain-event", {
    txHash,
    logIndex: 0,
    blockNumber: 503001,
    blockTimestamp: "2026-04-21T09:21:00.000Z",
    confirmedAt: "2026-04-21T09:21:00.000Z",
    from: "0x9999999999999999999999999999999999999999",
    to: "0x1111111111111111111111111111111111111111",
    token: "USDC",
    amount: "903000000",
    decimals: 6,
    chainId: 777,
    rawPayload: {
      source: "webhook-regression"
    }
  });

  assert(raw.data.observation?.id, "raw event creates observation");

  const match = await postMock(
    `/payments/mock/observations/${raw.data.observation.id}/match`,
    {
      paymentId: scenario.paymentId
    }
  );
  assertEqual(match.data.payment.status, "processing", "matched payment status");

  const finalized = await postMock("/payments/mock/chain-confirmation", {
    paymentId: scenario.paymentId,
    txHash,
    blockNumber: 503006,
    settlementReference: "webhook-regression-finalized"
  });
  assertEqual(finalized.data.status, "finalized", "finalized payment status");

  const initialDeliveries = await getAuthed("/payments/webhook-deliveries?queue=all");
  const originalDelivery = findDelivery(
    initialDeliveries,
    scenario.paymentId,
    "payment.finalized"
  );

  assert(originalDelivery, "initial finalized webhook delivery exists");
  assertEqual(
    originalDelivery.status,
    "disabled",
    "initial delivery disabled without URL"
  );
  assertEqual(
    originalDelivery.diagnostic.label,
    "No destination configured",
    "disabled delivery diagnostic label"
  );
  assert(
    originalDelivery.diagnostic.nextAction,
    "disabled delivery diagnostic gives next action"
  );
  assertEqual(originalDelivery.attemptCount, 1, "initial delivery attempted once");

  const originalPayload = stableJson(originalDelivery.payload);
  const originalDeliverySnapshot = {
    id: originalDelivery.id,
    eventId: originalDelivery.eventId,
    eventCreatedAt: originalDelivery.eventCreatedAt,
    attemptCount: originalDelivery.attemptCount,
    payload: originalPayload
  };

  await postMock("/payments/mock/chain-confirmation", {
    paymentId: scenario.paymentId,
    txHash,
    blockNumber: 503007,
    settlementReference: "webhook-regression-finalized-repeat"
  });

  const afterDuplicateTerminal = await getAuthed(
    "/payments/webhook-deliveries?queue=all"
  );
  assertEqual(
    countDeliveries(afterDuplicateTerminal, scenario.paymentId, "payment.finalized"),
    1,
    "duplicate terminal call does not create canonical delivery"
  );

  const retry = await postAuthed(
    `/payments/webhook-deliveries/${originalDelivery.id}/retry`,
    {}
  );
  assertEqual(retry.data.id, originalDelivery.id, "retry updates same delivery");
  assertEqual(retry.data.status, "disabled", "retry remains disabled without URL");
  assertEqual(
    retry.data.diagnostic.label,
    "No destination configured",
    "retry diagnostic is preserved"
  );
  assertEqual(retry.data.attemptCount, 2, "retry increments attempt count");
  assertEqual(
    stableJson(retry.data.payload),
    originalPayload,
    "retry preserves payload"
  );

  const replay = await postAuthed(
    `/payments/${scenario.paymentId}/webhook-replay`,
    {}
  );
  assert(replay.data.id !== originalDelivery.id, "replay creates new delivery");
  assertEqual(
    replay.data.replayOfDeliveryId,
    originalDelivery.id,
    "replay links original delivery"
  );
  assertEqual(replay.data.eventId, originalDelivery.eventId, "replay preserves event id");
  assertEqual(
    replay.data.eventCreatedAt,
    originalDelivery.eventCreatedAt,
    "replay preserves event timestamp"
  );
  assertEqual(
    stableJson(replay.data.payload),
    originalPayload,
    "replay preserves event payload"
  );

  const afterReplay = await getAuthed("/payments/webhook-deliveries?queue=all");
  assertEqual(
    countDeliveries(afterReplay, scenario.paymentId, "payment.finalized"),
    2,
    "replay creates exactly one linked delivery"
  );

  const originalAfterReplay = afterReplay.data.find(
    (entry) => entry.id === originalDelivery.id
  );
  assert(originalAfterReplay, "original delivery still exists after replay");
  assertEqual(
    originalAfterReplay.replayOfDeliveryId,
    null,
    "original delivery remains canonical"
  );
  assertEqual(
    originalAfterReplay.eventId,
    originalDeliverySnapshot.eventId,
    "original event id unchanged"
  );
  assertEqual(
    originalAfterReplay.eventCreatedAt,
    originalDeliverySnapshot.eventCreatedAt,
    "original event timestamp unchanged"
  );
  assertEqual(
    originalAfterReplay.attemptCount,
    originalDeliverySnapshot.attemptCount + 1,
    "original retry attempt count remains intact after replay"
  );
  assertEqual(
    stableJson(originalAfterReplay.payload),
    originalDeliverySnapshot.payload,
    "replay does not mutate original payload"
  );
}

async function createPayableScenario(input) {
  const invoice = await postAuthed("/invoices", {
    customerId: "cus_seed_acme",
    amountMinor: input.amountMinor,
    currency: "USD",
    dueAt: "2026-05-15T00:00:00.000Z",
    memo: input.memo,
    internalNote: input.internalNote,
    publish: true
  });

  const session = await postJson(
    `/public/invoices/${invoice.data.publicToken}/payment-session`,
    {}
  );

  assert(session.data.paymentId, "payment session creates payment id");

  return {
    invoiceId: invoice.data.id,
    publicToken: invoice.data.publicToken,
    paymentId: session.data.paymentId
  };
}

function findDelivery(payload, paymentId, eventType) {
  return payload.data.find(
    (entry) => entry.paymentId === paymentId && entry.eventType === eventType
  );
}

function countDeliveries(payload, paymentId, eventType) {
  return payload.data.filter(
    (entry) => entry.paymentId === paymentId && entry.eventType === eventType
  ).length;
}

async function getAuthed(pathname) {
  return request(pathname, {
    headers: { Authorization: `Bearer ${operatorToken}` }
  });
}

async function postAuthed(pathname, body) {
  return postJson(pathname, body, { Authorization: `Bearer ${operatorToken}` });
}

async function postMock(pathname, body) {
  return postJson(pathname, body, { "x-mock-chain-key": mockChainKey });
}

async function postJson(pathname, body, headers = {}) {
  return request(pathname, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: JSON.stringify(body)
  });
}

async function request(pathname, init = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${pathname}: ${JSON.stringify(payload)}`
    );
  }

  return payload;
}

function startApi() {
  const child = spawn(process.execPath, ["dist/main.js"], {
    cwd: apiDir,
    env: {
      ...process.env,
      PORT: process.env.TEST_WEBHOOK_API_PORT || "4518",
      DATABASE_URL:
        process.env.DATABASE_URL ||
        "postgresql://postgres:postgres@127.0.0.1:5432/stablebooks?schema=public",
      STABLEBOOKS_STORAGE_MODE: "postgres_reads",
      STABLEBOOKS_INVOICE_WRITE_MODE: "postgres",
      STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE: "postgres",
      STABLEBOOKS_MATCHING_WRITE_MODE: "postgres",
      STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE: "postgres",
      STABLEBOOKS_WEBHOOK_WRITE_MODE: "postgres",
      STABLEBOOKS_WEBHOOK_URL: ""
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout.on("data", (chunk) => {
    if (process.env.TEST_VERBOSE) {
      process.stdout.write(chunk);
    }
  });
  child.stderr.on("data", (chunk) => {
    if (process.env.TEST_VERBOSE) {
      process.stderr.write(chunk);
    }
  });

  return child;
}

async function waitForApi() {
  const deadline = Date.now() + 15000;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const health = await request("/health/storage");
      assertEqual(health.status, "ok", "storage health status");
      assertEqual(
        health.data.storageMode,
        "postgres_reads",
        "postgres read mode"
      );
      assertEqual(
        health.data.postgresBackedRuntimeReady,
        true,
        "postgres-backed runtime readiness"
      );
      assertEqual(
        health.data.runtimeWriteModes.invoiceWriteMode,
        "postgres",
        "invoice write mode"
      );
      assertEqual(
        health.data.runtimeWriteModes.paymentSessionWriteMode,
        "postgres",
        "payment session write mode"
      );
      assertEqual(
        health.data.runtimeWriteModes.matchingWriteMode,
        "postgres",
        "matching write mode"
      );
      assertEqual(
        health.data.runtimeWriteModes.terminalPaymentWriteMode,
        "postgres",
        "terminal payment write mode"
      );
      assertEqual(
        health.data.runtimeWriteModes.webhookWriteMode,
        "postgres",
        "webhook write mode"
      );
      return;
    } catch (error) {
      lastError = error;
      await sleep(250);
    }
  }

  throw lastError ?? new Error("API did not become ready.");
}

async function cleanupPostgresScenario(prisma) {
  const invoices = await prisma.invoice.findMany({
    where: { internalNote: { startsWith: notePrefix } },
    select: { id: true }
  });
  const invoiceIds = invoices.map((invoice) => invoice.id);

  if (invoiceIds.length) {
    await prisma.webhookDelivery.deleteMany({
      where: { invoiceId: { in: invoiceIds } }
    });
    await prisma.paymentEvent.deleteMany({
      where: { invoiceId: { in: invoiceIds } }
    });
    await prisma.paymentMatch.deleteMany({
      where: { invoiceId: { in: invoiceIds } }
    });
    await prisma.payment.deleteMany({
      where: { invoiceId: { in: invoiceIds } }
    });
    await prisma.chainPaymentObservation.updateMany({
      where: { invoiceId: { in: invoiceIds } },
      data: { invoiceId: null, paymentId: null }
    });
    await prisma.invoice.deleteMany({
      where: { id: { in: invoiceIds } }
    });
  }

  await prisma.chainPaymentObservation.deleteMany({
    where: { txHash }
  });
  await prisma.rawChainEvent.deleteMany({
    where: { txHash }
  });
}

function stableJson(value) {
  return JSON.stringify(value);
}

function assert(value, message) {
  if (!value) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      `Assertion failed: ${message}. Expected ${JSON.stringify(
        expected
      )}, got ${JSON.stringify(actual)}.`
    );
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
