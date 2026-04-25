const crypto = require("node:crypto");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

async function main() {
  const config = readConfig();
  const payload = buildPayload(config);

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          endpoint: config.endpoint,
          hasWebhookSecret: Boolean(config.webhookSecret),
          payloadPreview: {
            txHash: payload.notification.txHash,
            chainId: payload.notification.chainId,
            contractAddress: payload.notification.contractAddress,
            eventSignature: payload.notification.eventSignature,
            tokenSymbol: payload.notification.tokenSymbol,
            tokenDecimals: payload.notification.tokenDecimals,
            decoded: payload.notification.decoded
          }
        },
        null,
        2
      )
    );
    return;
  }

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-arc-webhook-secret": config.webhookSecret
    },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      `Arc webhook smoke failed with HTTP ${response.status}: ${JSON.stringify(body)}`
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        status: response.status,
        providerBoundary: body?.data?.providerBoundary ?? null,
        providerDiagnostic: body?.data?.providerDiagnostic ?? null,
        matchResult: body?.data?.match?.matchResult ?? null,
        paymentStatus: body?.data?.payment?.status ?? null
      },
      null,
      2
    )
  );
}

function readConfig() {
  const baseUrl = requireEnv("ARC_WEBHOOK_BASE_URL").replace(/\/+$/, "");
  const chainId = readIntEnv("ARC_CHAIN_ID");
  const tokenDecimals = readIntEnv("ARC_EVENT_TOKEN_DECIMALS");

  return {
    endpoint: `${baseUrl}/api/v1/arc/webhooks/events`,
    webhookSecret: requireEnv("ARC_WEBHOOK_SECRET"),
    chainId,
    contractAddress: requireEnv("ARC_EVENT_CONTRACT_ADDRESS"),
    eventSignature: requireEnv("ARC_EVENT_SIGNATURE"),
    tokenSymbol: requireEnv("ARC_EVENT_TOKEN_SYMBOL").toUpperCase(),
    tokenDecimals,
    txHash: optionalEnv("ARC_SMOKE_TX_HASH") ?? `0x${crypto.randomBytes(32).toString("hex")}`,
    blockNumber: readOptionalIntEnv("ARC_SMOKE_BLOCK_NUMBER") ?? Math.floor(Date.now() / 1000),
    confirmedAt: optionalEnv("ARC_SMOKE_CONFIRMED_AT") ?? new Date().toISOString(),
    from: optionalEnv("ARC_SMOKE_FROM") ?? "0x6666666666666666666666666666666666666666",
    to: requireEnv("ARC_SMOKE_TO"),
    amount:
      optionalEnv("ARC_SMOKE_AMOUNT_ATOMIC") ??
      String(100 * 10 ** tokenDecimals)
  };
}

function buildPayload(config) {
  return {
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
        to: config.to,
        amount: config.amount,
        token: config.tokenSymbol,
        decimals: config.tokenDecimals,
        chainId: config.chainId
      }
    }
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
  const value = Number(requireEnv(name));
  if (!Number.isInteger(value)) {
    throw new Error(`Env var ${name} must be an integer.`);
  }

  return value;
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
