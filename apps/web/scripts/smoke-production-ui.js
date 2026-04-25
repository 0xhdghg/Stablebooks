const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

async function main() {
  const config = readConfig();
  const plan = buildPlan(config);

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          baseUrl: config.baseUrl,
          hasOperatorToken: Boolean(config.operatorToken),
          routes: plan.map((check) => ({
            name: check.name,
            path: check.path,
            authenticated: check.authenticated,
            expectedIncludes: check.expectedIncludes,
            expectedExcludes: check.expectedExcludes
          }))
        },
        null,
        2
      )
    );
    return;
  }

  const results = [];

  for (const check of plan) {
    const result = await runRouteCheck(config, check);
    results.push(result);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl: config.baseUrl,
        checks: results
      },
      null,
      2
    )
  );
}

function buildPlan(config) {
  return [
    {
      name: "signin",
      path: "/signin",
      authenticated: false,
      expectedIncludes: ["Stablebooks", "Sign in"],
      expectedExcludes: []
    },
    {
      name: "dashboard",
      path: "/dashboard",
      authenticated: true,
      expectedIncludes: ["Stablebooks Workspace", "Dashboard"],
      expectedExcludes: []
    },
    {
      name: "invoice-detail",
      path: `/invoices/${config.invoiceId}`,
      authenticated: true,
      expectedIncludes: [
        config.invoiceId,
        config.expectedInvoiceStatus,
        config.expectedPaymentStatus,
        "Provider source",
        ...(config.expectedTxHash ? [config.expectedTxHash] : []),
        "Webhook"
      ],
      expectedExcludes: []
    },
    {
      name: "payment-detail",
      path: `/payments/${config.paymentId}`,
      authenticated: true,
      expectedIncludes: [
        config.paymentId,
        config.expectedPaymentStatus,
        "Provider source",
        "Chain source confirmed",
        ...(config.expectedTxHash ? [config.expectedTxHash] : []),
        "Webhook"
      ],
      expectedExcludes: []
    },
    {
      name: "webhook-queue",
      path: "/webhooks?queue=all",
      authenticated: true,
      expectedIncludes: [
        "payment.finalized",
        config.expectedWebhookStatus,
        "No destination configured",
        shortId(config.paymentId)
      ],
      expectedExcludes: []
    },
    {
      name: "hosted-paid-page",
      path: `/pay/${config.publicToken}`,
      authenticated: false,
      expectedIncludes: ["Stablebooks Pay", "Payment complete"],
      expectedExcludes: [
        "Simulate stablecoin payment",
        "Provider source",
        "webhook delivery",
        "payment_finalized",
        ...(config.expectedTxHash ? [config.expectedTxHash] : [])
      ]
    }
  ];
}

async function runRouteCheck(config, check) {
  const url = `${config.baseUrl}${check.path}`;
  const response = await fetch(url, {
    headers: check.authenticated
      ? { Authorization: `Bearer ${config.operatorToken}` }
      : undefined,
    redirect: "manual"
  });
  const html = await response.text();

  assert(
    response.status === 200,
    `${check.name} expected HTTP 200, got ${response.status}.`
  );

  const missing = check.expectedIncludes.filter(
    (value) => value && !html.includes(value)
  );
  assert(
    missing.length === 0,
    `${check.name} missing expected text: ${missing.join(", ")}.`
  );

  const leaked = check.expectedExcludes.filter(
    (value) => value && html.includes(value)
  );
  assert(
    leaked.length === 0,
    `${check.name} included forbidden text: ${leaked.join(", ")}.`
  );

  return {
    name: check.name,
    path: check.path,
    status: response.status,
    authenticated: check.authenticated,
    includeAssertions: check.expectedIncludes.length,
    excludeAssertions: check.expectedExcludes.length,
    htmlBytes: html.length
  };
}

function readConfig() {
  return {
    baseUrl: requireEnv("SMOKE_WEB_BASE_URL").replace(/\/+$/, ""),
    operatorToken: requireEnv("SMOKE_OPERATOR_TOKEN"),
    invoiceId: requireEnv("SMOKE_INVOICE_ID"),
    paymentId: requireEnv("SMOKE_PAYMENT_ID"),
    publicToken: requireEnv("SMOKE_PUBLIC_TOKEN"),
    expectedTxHash: optionalEnv("SMOKE_EXPECTED_TX_HASH"),
    expectedWebhookStatus:
      optionalEnv("SMOKE_EXPECTED_WEBHOOK_STATUS") ?? "disabled",
    expectedInvoiceStatus:
      optionalEnv("SMOKE_EXPECTED_INVOICE_STATUS") ?? "paid",
    expectedPaymentStatus:
      optionalEnv("SMOKE_EXPECTED_PAYMENT_STATUS") ?? "finalized"
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

function assert(value, message) {
  if (!value) {
    throw new Error(message);
  }
}

function shortId(value) {
  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}
