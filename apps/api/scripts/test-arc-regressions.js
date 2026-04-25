const { spawn } = require("node:child_process");
const {
  createPrivateKey,
  createSign,
  generateKeyPairSync
} = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const apiDir = path.resolve(__dirname, "..");
const storePath = path.join(apiDir, "data", "app-store.json");
const backupPath = path.join(apiDir, "data", "app-store.before-arc-regressions.json");
const baseUrl = `http://127.0.0.1:${process.env.TEST_API_PORT || "4517"}/api/v1`;
const operatorToken = "sb_6a83a3316556e3139feb1f6833fc93e543e79e495d0ef484";
const arcSecret = "replace-me";
const decodedProviderTxHash =
  "0xregprovider000000000000000000000000000000000000000000000000000001";
const finalizedTxHash =
  "0xregfinalized00000000000000000000000000000000000000000000000000000001";
const failedTxHash =
  "0xregfailed0000000000000000000000000000000000000000000000000000000001";
const circleSignedTxHash =
  "0xregcircle000000000000000000000000000000000000000000000000000000001";
const txHashes = [
  decodedProviderTxHash,
  finalizedTxHash,
  failedTxHash,
  circleSignedTxHash
];
const circleKeyId = "circle-regression-key";
const circleKeys = generateKeyPairSync("ec", { namedCurve: "P-256" });
const circlePublicKeyBase64 = circleKeys.publicKey
  .export({ format: "der", type: "spki" })
  .toString("base64");
const circlePrivateKey = createPrivateKey(
  circleKeys.privateKey.export({ format: "pem", type: "pkcs8" })
);

let apiProcess = null;

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  await backupStore();
  const prisma = new PrismaClient();

  try {
    await cleanupPostgresEvidence(prisma);
    await ensureSeedStore();
    apiProcess = startApi();
    await waitForApi();
    await runReadinessRegression();
    await runProviderBoundaryRegression();
    await runProviderProfileValidationRegression();
    await runCircleWebhookSignatureRegression();

    await runDecodedProviderPayloadRegression();
    await runFinalizedRegression();
    await runFailedRegression();

    console.log("Arc finalized/failed regressions passed.");
  } finally {
    if (apiProcess) {
      apiProcess.kill();
    }

    await cleanupPostgresEvidence(prisma).catch((error) => {
      console.warn(`Postgres evidence cleanup failed: ${error.message}`);
    });
    await prisma.$disconnect();
    await restoreStore();
  }
}

async function runCircleWebhookSignatureRegression() {
  const testNotification = await postCircleSignedJson("/arc/webhooks/events", {
    subscriptionId: "00000000-0000-0000-0000-000000000000",
    notificationId: "00000000-0000-0000-0000-000000000000",
    notificationType: "webhooks.test",
    notification: { hello: "world" },
    timestamp: "2026-04-25T11:47:45.178155989Z",
    version: 2
  });

  assertEqual(
    testNotification.data.accepted,
    true,
    "Circle test notification accepted"
  );
  assertEqual(
    testNotification.data.action,
    "acknowledged",
    "Circle test notification action"
  );

  const invalidSignature = await postJsonExpectError(
    "/arc/webhooks/events",
    {
      subscriptionId: "00000000-0000-0000-0000-000000000000",
      notificationId: "00000000-0000-0000-0000-000000000001",
      notificationType: "webhooks.test",
      notification: { hello: "world" },
      timestamp: "2026-04-25T11:48:45.178155989Z",
      version: 2
    },
    {
      "x-circle-key-id": circleKeyId,
      "x-circle-signature": "invalid-signature"
    },
    401
  );

  assert(
    JSON.stringify(invalidSignature).includes("Invalid Circle webhook signature"),
    "Circle invalid signature is rejected"
  );

  const scenario = await createPayableScenario({
    amountMinor: 90400,
    memo: "Circle signed event regression invoice",
    internalNote: "Temporary Circle signed regression"
  });

  const eventResponse = await postCircleSignedJson(
    "/arc/webhooks/events",
    buildCircleEventLogPayload({
      txHash: circleSignedTxHash,
      blockNumber: 504001,
      confirmedAt: "2026-04-25T12:01:00.000Z",
      amount: "904000000"
    })
  );

  assertEqual(
    eventResponse.data.providerBoundary.kind,
    "circle_event_monitor",
    "Circle signed event boundary kind"
  );
  assertEqual(
    eventResponse.data.providerDiagnostic.sourceProfileMatched,
    true,
    "Circle signed event source profile matched"
  );
  assertEqual(
    eventResponse.data.match.matchResult,
    "exact",
    "Circle signed event match result"
  );
  assertEqual(
    eventResponse.data.payment.status,
    "processing",
    "Circle signed event processing status"
  );

  const finalityResponse = await postArcFinality({
    txHash: circleSignedTxHash,
    outcome: "finalized",
    blockNumber: 504006,
    confirmedAt: "2026-04-25T12:06:00.000Z",
    settlementReference: "circle-regression-001"
  });

  assertEqual(
    finalityResponse.data.payment.status,
    "finalized",
    "Circle signed event finalized payment status"
  );

  const invoice = await getAuthed(`/invoices/${scenario.invoiceId}`);
  assertEqual(invoice.data.status, "paid", "Circle signed event invoice paid");
}

async function runReadinessRegression() {
  const readiness = await getArcDev("/arc/dev/readiness");

  assertEqual(readiness.data.ready, true, "arc readiness ready");
  assertEqual(readiness.data.sourceKind, "webhook", "arc readiness source kind");
  assertEqual(
    readiness.data.config.hasWebhookSecret,
    true,
    "arc readiness reports webhook secret presence"
  );
  assertEqual(
    readiness.data.config.hasRpcUrl,
    false,
    "arc readiness reports rpc url absence"
  );
  assertEqual(
    readiness.data.config.sourceProfile.provider,
    "circle_event_monitor",
    "arc readiness source profile provider"
  );
  assertEqual(
    readiness.data.config.sourceProfile.tokenSymbol,
    "USDC",
    "arc readiness source profile token"
  );
  assertEqual(
    readiness.data.config.sourceProfile.tokenDecimals,
    6,
    "arc readiness source profile decimals"
  );
  assertEqual(
    Object.prototype.hasOwnProperty.call(readiness.data.config, "webhookSecret"),
    false,
    "arc readiness does not expose webhook secret value"
  );
  assertEqual(
    Object.prototype.hasOwnProperty.call(readiness.data.config, "rpcUrl"),
    false,
    "arc readiness does not expose rpc url value"
  );
}

async function runProviderBoundaryRegression() {
  const errorPayload = await postJsonExpectError(
    "/arc/webhooks/events",
    {
      notification: {
        blockchain: "ARC-TESTNET",
        txHash:
          "0xreglowlevel0000000000000000000000000000000000000000000000000001",
        blockHeight: 501000,
        firstConfirmDate: "2026-04-21T09:00:00.000Z",
        contractAddress: "0x0000000000000000000000000000000000000001",
        topics: [
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
        ],
        data: "0x"
      }
    },
    { "x-arc-webhook-secret": arcSecret },
    400
  );

  assert(
    JSON.stringify(errorPayload).includes("decoded Transfer args"),
    "low-level Circle event monitor payload is rejected before canonical ingestion"
  );
  assertEqual(
    errorPayload.rejectedReason,
    "missing_decoded_transfer_args",
    "low-level provider rejection reason"
  );
  assertEqual(
    errorPayload.providerDiagnostic.sourceProfileMatched,
    false,
    "low-level provider diagnostic profile match"
  );
}

async function runProviderProfileValidationRegression() {
  const before = await getArcDev("/arc/dev/evidence-store");
  const cases = [
    {
      name: "wrong chain id",
      payload: buildArcDecodedProviderPayload(
        {
          txHash:
            "0xregwrongchain00000000000000000000000000000000000000000000000001",
          blockNumber: 503101,
          confirmedAt: "2026-04-21T09:31:00.000Z",
          amount: "1"
        },
        {
          notification: { chainId: 778 },
          decoded: { chainId: 778 }
        }
      ),
      expected: "chainId",
      rejectedReason: "chain_id_mismatch"
    },
    {
      name: "wrong contract address",
      payload: buildArcDecodedProviderPayload(
        {
          txHash:
            "0xregwrongcontract0000000000000000000000000000000000000000000001",
          blockNumber: 503102,
          confirmedAt: "2026-04-21T09:32:00.000Z",
          amount: "1"
        },
        {
          notification: {
            contractAddress: "0x0000000000000000000000000000000000000002"
          }
        }
      ),
      expected: "contractAddress",
      rejectedReason: "contract_address_mismatch"
    },
    {
      name: "wrong event signature",
      payload: buildArcDecodedProviderPayload(
        {
          txHash:
            "0xregwrongevent00000000000000000000000000000000000000000000000001",
          blockNumber: 503103,
          confirmedAt: "2026-04-21T09:33:00.000Z",
          amount: "1"
        },
        {
          notification: { eventSignature: "Approval(address,address,uint256)" }
        }
      ),
      expected: "event signature",
      rejectedReason: "event_signature_mismatch"
    },
    {
      name: "wrong token",
      payload: buildArcDecodedProviderPayload(
        {
          txHash:
            "0xregwrongtoken000000000000000000000000000000000000000000000000001",
          blockNumber: 503104,
          confirmedAt: "2026-04-21T09:34:00.000Z",
          amount: "1"
        },
        {
          notification: { tokenSymbol: "EURC" },
          decoded: { token: "EURC" }
        }
      ),
      expected: "token",
      rejectedReason: "token_symbol_mismatch"
    },
    {
      name: "wrong decimals",
      payload: buildArcDecodedProviderPayload(
        {
          txHash:
            "0xregwrongdecimals0000000000000000000000000000000000000000000001",
          blockNumber: 503105,
          confirmedAt: "2026-04-21T09:35:00.000Z",
          amount: "1"
        },
        {
          notification: { tokenDecimals: 18 },
          decoded: { decimals: 18 }
        }
      ),
      expected: "decimals",
      rejectedReason: "token_decimals_mismatch"
    }
  ];

  for (const testCase of cases) {
    const errorPayload = await postJsonExpectError(
      "/arc/webhooks/events",
      testCase.payload,
      { "x-arc-webhook-secret": arcSecret },
      400
    );

    assert(
      JSON.stringify(errorPayload).includes(testCase.expected),
      `provider profile rejects ${testCase.name}`
    );
    assertEqual(
      errorPayload.rejectedReason,
      testCase.rejectedReason,
      `provider profile exact rejection reason for ${testCase.name}`
    );
    assert(
      typeof errorPayload.rejectedReason === "string" &&
        errorPayload.rejectedReason.length > 0,
      `provider profile exposes rejection reason for ${testCase.name}`
    );
    assertEqual(
      errorPayload.providerDiagnostic.boundaryKind,
      "circle_event_monitor",
      `provider profile diagnostic boundary for ${testCase.name}`
    );
    assertEqual(
      errorPayload.providerDiagnostic.sourceProfileMatched,
      false,
      `provider profile diagnostic match flag for ${testCase.name}`
    );
  }

  const after = await getArcDev("/arc/dev/evidence-store");
  assertEqual(
    after.data.summary.rawEventCount,
    before.data.summary.rawEventCount,
    "rejected provider payloads do not create raw events"
  );
  assertEqual(
    after.data.summary.observationCount,
    before.data.summary.observationCount,
    "rejected provider payloads do not create observations"
  );
}

async function runDecodedProviderPayloadRegression() {
  const scenario = await createPayableScenario({
    amountMinor: 90300,
    memo: "Arc provider-shaped regression invoice",
    internalNote: "Temporary provider-shaped regression"
  });

  const eventResponse = await postArcDecodedProviderEvent({
    txHash: decodedProviderTxHash,
    blockNumber: 503001,
    confirmedAt: "2026-04-21T09:21:00.000Z",
    amount: "903000000"
  });

  assertEqual(
    eventResponse.data.providerBoundary.kind,
    "circle_event_monitor",
    "decoded provider boundary kind"
  );
  assertEqual(
    eventResponse.data.providerBoundary.sourceProfileMatched,
    true,
    "decoded provider profile matched"
  );
  assertEqual(
    eventResponse.data.providerDiagnostic.boundaryKind,
    "circle_event_monitor",
    "decoded provider diagnostic boundary kind"
  );
  assertEqual(
    eventResponse.data.providerDiagnostic.sourceProfileMatched,
    true,
    "decoded provider diagnostic profile matched"
  );
  assertEqual(
    eventResponse.data.providerDiagnostic.providerWarnings.length,
    0,
    "decoded provider diagnostic warnings"
  );
  assertEqual(
    eventResponse.data.canonicalEvent.chainId,
    777,
    "decoded provider chain id"
  );
  assertEqual(
    eventResponse.data.canonicalEvent.token,
    "USDC",
    "decoded provider token"
  );
  assertEqual(
    eventResponse.data.postgresMirror.status,
    "created",
    "decoded provider postgres mirror status"
  );
  assertEqual(
    eventResponse.data.match.matchResult,
    "exact",
    "decoded provider match result"
  );
  assertEqual(
    eventResponse.data.payment.status,
    "processing",
    "decoded provider processing status"
  );

  const evidence = await getArcDev("/arc/dev/evidence-store");
  assertEqual(
    evidence.data.summary.latestRawEvent.txHash,
    decodedProviderTxHash,
    "decoded provider raw evidence tx hash"
  );

  const finalityResponse = await postArcFinality({
    txHash: decodedProviderTxHash,
    outcome: "finalized",
    blockNumber: 503006,
    confirmedAt: "2026-04-21T09:26:00.000Z",
    settlementReference: "arc-reg-provider-001"
  });

  assertEqual(
    finalityResponse.data.payment.status,
    "finalized",
    "decoded provider finalized payment status"
  );

  const invoice = await getAuthed(`/invoices/${scenario.invoiceId}`);
  assertEqual(invoice.data.status, "paid", "decoded provider invoice status");

  const payment = await getAuthed(`/payments/${scenario.paymentId}`);
  assertEqual(
    payment.data.sourceConfirmedAt,
    "2026-04-21T09:26:00.000Z",
    "decoded provider source confirmation time"
  );
  assertEqual(
    payment.data.providerDiagnostic.boundaryKind,
    "circle_event_monitor",
    "decoded provider payment detail diagnostic boundary"
  );
  assertEqual(
    payment.data.providerDiagnostic.sourceProfileMatched,
    true,
    "decoded provider payment detail profile match"
  );

  const deliveries = await getAuthed("/payments/webhook-deliveries?queue=all");
  const delivery = deliveries.data.find(
    (entry) =>
      entry.paymentId === scenario.paymentId &&
      entry.eventType === "payment.finalized"
  );

  assert(delivery, "decoded provider finalized webhook delivery exists");
  assertEqual(
    delivery.status,
    "disabled",
    "decoded provider webhook disabled without URL"
  );
}

async function runFinalizedRegression() {
  const scenario = await createPayableScenario({
    amountMinor: 90100,
    memo: "Arc finalized regression invoice",
    internalNote: "Temporary finalized regression"
  });

  const eventResponse = await postArcEvent({
    txHash: finalizedTxHash,
    blockNumber: 501001,
    confirmedAt: "2026-04-21T09:01:00.000Z",
    amount: "901000000"
  });

  assertEqual(eventResponse.data.match.matchResult, "exact", "finalized match result");
  assertEqual(eventResponse.data.payment.status, "processing", "finalized processing status");
  assertEqual(
    eventResponse.data.providerBoundary.kind,
    "canonical",
    "finalized provider boundary kind"
  );
  assertEqual(
    eventResponse.data.providerBoundary.sourceProfileMatched,
    null,
    "finalized canonical provider profile match"
  );
  assertEqual(
    eventResponse.data.postgresMirror.status,
    "created",
    "finalized postgres mirror status"
  );

  const finalityResponse = await postArcFinality({
    txHash: finalizedTxHash,
    outcome: "finalized",
    blockNumber: 501006,
    confirmedAt: "2026-04-21T09:06:00.000Z",
    settlementReference: "arc-reg-finalized-001"
  });

  assertEqual(finalityResponse.data.payment.status, "finalized", "finalized payment status");
  assertEqual(
    finalityResponse.data.providerBoundary.kind,
    "canonical",
    "finalized finality boundary kind"
  );
  assertEqual(
    finalityResponse.data.providerDiagnostic.sourceProfileMatched,
    null,
    "finalized finality diagnostic profile match"
  );

  const invoice = await getAuthed(`/invoices/${scenario.invoiceId}`);
  assertEqual(invoice.data.status, "paid", "finalized invoice status");

  const payment = await getAuthed(`/payments/${scenario.paymentId}`);
  assertEqual(payment.data.status, "finalized", "finalized payment detail status");
  assertEqual(
    payment.data.confirmationSource,
    "arc_ingestion",
    "finalized confirmation source"
  );
  assertEqual(
    payment.data.sourceConfirmedAt,
    "2026-04-21T09:06:00.000Z",
    "finalized source confirmation time"
  );

  const deliveries = await getAuthed("/payments/webhook-deliveries?queue=all");
  const delivery = deliveries.data.find(
    (entry) =>
      entry.paymentId === scenario.paymentId &&
      entry.eventType === "payment.finalized"
  );

  assert(delivery, "finalized webhook delivery exists");
  assertEqual(delivery.status, "disabled", "finalized webhook disabled without URL");
  assertEqual(
    delivery.paymentStatusSnapshot,
    "finalized",
    "finalized webhook payment snapshot"
  );
  assertEqual(delivery.invoiceStatusSnapshot, "paid", "finalized webhook invoice snapshot");
}

async function runFailedRegression() {
  const scenario = await createPayableScenario({
    amountMinor: 90200,
    memo: "Arc failed regression invoice",
    internalNote: "Temporary failed regression"
  });

  const eventResponse = await postArcEvent({
    txHash: failedTxHash,
    blockNumber: 502001,
    confirmedAt: "2026-04-21T09:11:00.000Z",
    amount: "902000000"
  });

  assertEqual(eventResponse.data.match.matchResult, "exact", "failed match result");
  assertEqual(eventResponse.data.payment.status, "processing", "failed processing status");
  assertEqual(
    eventResponse.data.providerBoundary.kind,
    "canonical",
    "failed provider boundary kind"
  );
  assertEqual(
    eventResponse.data.providerDiagnostic.sourceProfileMatched,
    null,
    "failed canonical diagnostic profile match"
  );
  assertEqual(
    eventResponse.data.postgresMirror.status,
    "created",
    "failed postgres mirror status"
  );

  const finalityResponse = await postArcFinality({
    txHash: failedTxHash,
    outcome: "failed",
    blockNumber: 502006,
    confirmedAt: "2026-04-21T09:16:00.000Z",
    failureReason: "Arc regression failure path"
  });

  assertEqual(finalityResponse.data.payment.status, "failed", "failed payment status");
  assertEqual(
    finalityResponse.data.providerBoundary.kind,
    "canonical",
    "failed finality boundary kind"
  );

  const invoice = await getAuthed(`/invoices/${scenario.invoiceId}`);
  assertEqual(invoice.data.status, "open", "failed invoice status");

  const payment = await getAuthed(`/payments/${scenario.paymentId}`);
  assertEqual(payment.data.status, "failed", "failed payment detail status");
  assertEqual(payment.data.failureReason, "Arc regression failure path", "failure reason");
  assertEqual(
    payment.data.confirmationSource,
    "arc_ingestion",
    "failed confirmation source"
  );
  assertEqual(
    payment.data.observation.status,
    "rejected",
    "failed observation status"
  );

  const deliveries = await getAuthed("/payments/webhook-deliveries?queue=all");
  const delivery = deliveries.data.find(
    (entry) =>
      entry.paymentId === scenario.paymentId &&
      entry.eventType === "payment.failed"
  );

  assert(delivery, "failed webhook delivery exists");
  assertEqual(delivery.status, "disabled", "failed webhook disabled without URL");
  assertEqual(delivery.paymentStatusSnapshot, "failed", "failed webhook payment snapshot");
  assertEqual(delivery.invoiceStatusSnapshot, "open", "failed webhook invoice snapshot");
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

  const session = await postPublic(
    `/public/invoices/${invoice.data.publicToken}/payment-session`,
    undefined
  );

  assert(session.data.paymentId, "payment session creates payment id");

  return {
    invoiceId: invoice.data.id,
    publicToken: invoice.data.publicToken,
    paymentId: session.data.paymentId
  };
}

async function postArcDecodedProviderEvent(input) {
  return postJson(
    "/arc/webhooks/events",
    buildArcDecodedProviderPayload(input),
    { "x-arc-webhook-secret": arcSecret }
  );
}

function buildArcDecodedProviderPayload(input, overrides = {}) {
  const decoded = {
    from: "0x6666666666666666666666666666666666666666",
    to: "0x1111111111111111111111111111111111111111",
    amount: input.amount,
    token: "USDC",
    decimals: 6,
    chainId: 777,
    ...(overrides.decoded ?? {}),
    ...(overrides.notification?.decoded ?? {})
  };

  return {
    notification: {
      blockchain: "ARC-TESTNET",
      chainId: 777,
      txHash: input.txHash,
      blockHeight: input.blockNumber,
      firstConfirmDate: input.confirmedAt,
      contractAddress: "0x0000000000000000000000000000000000000001",
      eventSignature: "Transfer(address,address,uint256)",
      tokenSymbol: "USDC",
      tokenDecimals: 6,
      logIndex: 0,
      topics: [
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      ],
      data: "0x",
      ...(overrides.notification ?? {}),
      decoded
    }
  };
}

function buildCircleEventLogPayload(input) {
  return {
    subscriptionId: "sub_circle_regression",
    notificationId: "notif_circle_regression",
    notificationType: "contracts.eventLog",
    notification: {
      blockchain: "ARC-TESTNET",
      chainId: 777,
      txHash: input.txHash,
      blockHeight: input.blockNumber,
      firstConfirmDate: input.confirmedAt,
      contractAddress: "0x0000000000000000000000000000000000000001",
      eventSignature: "Transfer(address,address,uint256)",
      tokenSymbol: "USDC",
      tokenDecimals: 6,
      logIndex: 0,
      topics: [
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      ],
      data: "0x",
      decoded: {
        from: "0x6666666666666666666666666666666666666666",
        to: "0x1111111111111111111111111111111111111111",
        amount: input.amount,
        token: "USDC",
        decimals: 6,
        chainId: 777
      }
    },
    timestamp: input.confirmedAt,
    version: 2
  };
}

async function postArcEvent(input) {
  return postJson(
    "/arc/webhooks/events",
    {
      txHash: input.txHash,
      blockNumber: input.blockNumber,
      confirmedAt: input.confirmedAt,
      from: "0x6666666666666666666666666666666666666666",
      to: "0x1111111111111111111111111111111111111111",
      token: "USDC",
      amount: input.amount,
      decimals: 6,
      chainId: 777,
      logIndex: 0,
      blockTimestamp: input.confirmedAt,
      provider: "arc-regression-test"
    },
    { "x-arc-webhook-secret": arcSecret }
  );
}

async function postArcFinality(input) {
  return postJson(
    "/arc/webhooks/finality",
    {
      txHash: input.txHash,
      chainId: 777,
      logIndex: 0,
      outcome: input.outcome,
      confirmedAt: input.confirmedAt,
      blockNumber: input.blockNumber,
      settlementReference: input.settlementReference,
      failureReason: input.failureReason
    },
    { "x-arc-webhook-secret": arcSecret }
  );
}

async function getAuthed(pathname) {
  return request(pathname, {
    headers: { Authorization: `Bearer ${operatorToken}` }
  });
}

async function getArcDev(pathname) {
  return request(pathname, {
    headers: { "x-arc-dev-key": "stablebooks-dev-arc-key" }
  });
}

async function postAuthed(pathname, body) {
  return postJson(pathname, body, { Authorization: `Bearer ${operatorToken}` });
}

async function postPublic(pathname, body) {
  return postJson(pathname, body ?? {});
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

async function postCircleSignedJson(pathname, body) {
  const serialized = JSON.stringify(body);
  return request(pathname, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-circle-key-id": circleKeyId,
      "x-circle-signature": signCirclePayload(serialized)
    },
    body: serialized
  });
}

function signCirclePayload(serialized) {
  const signer = createSign("SHA256");
  signer.update(Buffer.from(serialized));
  signer.end();
  return signer.sign(circlePrivateKey).toString("base64");
}

async function postJsonExpectError(pathname, body, headers, expectedStatus) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  assertEqual(response.status, expectedStatus, `${pathname} error status`);

  return payload;
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
      PORT: process.env.TEST_API_PORT || "4517",
      DATABASE_URL:
        process.env.DATABASE_URL ||
        "postgresql://postgres:postgres@127.0.0.1:5432/stablebooks?schema=public",
      STABLEBOOKS_STORAGE_MODE: "json",
      STABLEBOOKS_ARC_EVIDENCE_MIRROR: "postgres_shadow",
      ARC_SOURCE_ENABLED: "true",
      ARC_SOURCE_KIND: "webhook",
      ARC_CHAIN_ID: "777",
      ARC_WEBHOOK_SECRET: arcSecret,
      ARC_EVENT_MONITOR_SOURCE: "circle_contracts_api",
      ARC_EVENT_CONTRACT_ADDRESS: "0x0000000000000000000000000000000000000001",
      ARC_EVENT_SIGNATURE: "Transfer(address,address,uint256)",
      ARC_EVENT_TOKEN_SYMBOL: "USDC",
      ARC_EVENT_TOKEN_DECIMALS: "6",
      CIRCLE_WEBHOOK_PUBLIC_KEYS_JSON: JSON.stringify({
        [circleKeyId]: circlePublicKeyBase64
      }),
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
        health.data.arcEvidenceMirrorMode,
        "postgres_shadow",
        "arc evidence mirror mode"
      );
      assertEqual(
        health.data.runtimeWriteModes.matchingWriteMode,
        "json",
        "arc regression matching write mode remains fallback"
      );
      assertEqual(
        health.data.postgresBackedRuntimeReady,
        false,
        "arc regression is not full postgres-backed runtime"
      );
      return;
    } catch (error) {
      lastError = error;
      await sleep(250);
    }
  }

  throw lastError ?? new Error("API did not become ready.");
}

async function ensureSeedStore() {
  const raw = await fs.readFile(storePath, "utf8").catch(() => null);
  const store = raw ? JSON.parse(raw) : {};
  const hasSeedSession = (store.sessions ?? []).some(
    (session) => session.token === operatorToken
  );
  const hasSeedCustomer = (store.customers ?? []).some(
    (customer) => customer.id === "cus_seed_acme"
  );
  const hasSeedWallet = (store.wallets ?? []).some(
    (wallet) => wallet.id === "wal_seed_arc_collection"
  );

  if (hasSeedSession && hasSeedCustomer && hasSeedWallet) {
    return;
  }

  await runNodeScript(path.join(apiDir, "scripts", "seed-dev-store.js"));
}

async function runNodeScript(scriptPath) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: apiDir,
      stdio: "inherit"
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${path.basename(scriptPath)} exited with ${code}`));
    });
  });
}

async function backupStore() {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  const raw = await fs.readFile(storePath, "utf8").catch(() => null);
  await fs.writeFile(backupPath, raw ?? "{}", "utf8");
}

async function restoreStore() {
  const raw = await fs.readFile(backupPath, "utf8").catch(() => null);
  if (raw !== null) {
    await fs.writeFile(storePath, raw, "utf8");
    await fs.rm(backupPath, { force: true });
  }
}

async function cleanupPostgresEvidence(prisma) {
  await prisma.chainPaymentObservation.deleteMany({
    where: { txHash: { in: txHashes } }
  });
  await prisma.rawChainEvent.deleteMany({
    where: { txHash: { in: txHashes } }
  });
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
