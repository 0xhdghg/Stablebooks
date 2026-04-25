const path = require("node:path");

const { bootstrapHostedStaging } = require("./bootstrap-hosted-staging");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

async function main() {
  const bootstrap = dryRun
    ? buildDryRunBootstrap()
    : await bootstrapHostedStaging();

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          bootstrap,
          expectedSteps: [
            "bootstrap hosted staging operator/org/wallet/customer",
            "run api smoke-production-flow",
            "run web smoke-production-ui"
          ]
        },
        null,
        2
      )
    );
    return;
  }

  const flow = await runNodeScript(
    path.resolve(__dirname, "smoke-production-flow.js"),
    bootstrap.smokeEnv
  );
  const ui = await runNodeScript(
    path.resolve(__dirname, "..", "..", "web", "scripts", "smoke-production-ui.js"),
    {
      ...bootstrap.smokeEnv,
      SMOKE_INVOICE_ID: flow.invoiceId,
      SMOKE_PAYMENT_ID: flow.paymentId,
      SMOKE_PUBLIC_TOKEN: flow.publicToken,
      ...(flow.txHash ? { SMOKE_EXPECTED_TX_HASH: flow.txHash } : {})
    }
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        bootstrap: {
          operatorEmail: bootstrap.operator.email,
          organizationId: bootstrap.organization.id,
          customerId: bootstrap.customer.id,
          walletAddress: bootstrap.wallet.address
        },
        flow,
        ui
      },
      null,
      2
    )
  );
}

function buildDryRunBootstrap() {
  return {
    apiBaseUrl: process.env.STABLEBOOKS_API_BASE_URL ?? process.env.SMOKE_API_BASE_URL ?? null,
    webBaseUrl:
      process.env.STABLEBOOKS_WEB_BASE_URL ??
      process.env.SMOKE_WEB_BASE_URL ??
      "https://stablebooks-web-production.up.railway.app",
    smokeEnvKeys: [
      "SMOKE_API_BASE_URL",
      "SMOKE_WEB_BASE_URL",
      "SMOKE_OPERATOR_TOKEN",
      "SMOKE_CUSTOMER_ID",
      "SMOKE_SETTLEMENT_WALLET",
      "ARC_CHAIN_ID",
      "ARC_WEBHOOK_SECRET",
      "ARC_EVENT_CONTRACT_ADDRESS",
      "ARC_EVENT_SIGNATURE",
      "ARC_EVENT_TOKEN_SYMBOL",
      "ARC_EVENT_TOKEN_DECIMALS"
    ]
  };
}

async function runNodeScript(scriptPath, env) {
  const { spawn } = require("node:child_process");

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: path.dirname(scriptPath),
      env: {
        ...process.env,
        ...env
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            stderr.trim() || stdout.trim() || `${path.basename(scriptPath)} failed with code ${code}.`
          )
        );
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(
          new Error(
            `Could not parse JSON from ${path.basename(scriptPath)}: ${error.message}`
          )
        );
      }
    });
  });
}
