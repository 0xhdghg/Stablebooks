const { mkdir, writeFile } = require("node:fs/promises");
const { dirname, join } = require("node:path");
const { scryptSync } = require("node:crypto");

const filePath = join(__dirname, "..", "data", "app-store.json");

function hashPassword(password) {
  const salt = "stablebooks-seed-salt";
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const now = "2026-04-19T12:00:00.000Z";

  const store = {
    users: [
      {
        id: "usr_seed_operator",
        email: "operator@stablebooks.dev",
        name: "Stablebooks Operator",
        passwordHash: hashPassword("stablebooks123"),
        createdAt: now,
        updatedAt: now
      }
    ],
    sessions: [
      {
        token: "sb_seed_operator_token",
        userId: "usr_seed_operator",
        createdAt: now
      },
      {
        token: "sb_6a83a3316556e3139feb1f6833fc93e543e79e495d0ef484",
        userId: "usr_seed_operator",
        createdAt: now
      }
    ],
    organizations: [
      {
        id: "org_seed_stablebooks",
        name: "Stablebooks Demo Org",
        billingCountry: "US",
        baseCurrency: "USD",
        onboardingStatus: "completed",
        createdAt: now,
        updatedAt: now
      }
    ],
    memberships: [
      {
        id: "mbr_seed_operator_admin",
        userId: "usr_seed_operator",
        organizationId: "org_seed_stablebooks",
        role: "admin",
        createdAt: now
      }
    ],
    wallets: [
      {
        id: "wal_seed_arc_collection",
        organizationId: "org_seed_stablebooks",
        chain: "arc",
        address: "0x1111111111111111111111111111111111111111",
        label: "Primary Arc Collection",
        role: "collection",
        isDefaultSettlement: true,
        status: "active",
        createdAt: now,
        updatedAt: now
      }
    ],
    customers: [
      {
        id: "cus_seed_acme",
        organizationId: "org_seed_stablebooks",
        name: "Acme Treasury",
        email: "ap@acme.dev",
        billingCurrency: "USD",
        metadata: {
          segment: "design-partner",
          source: "milestone-4-seed"
        },
        createdAt: now,
        updatedAt: now
      }
    ],
    invoices: [
      {
        id: "inv_seed_apr_2026",
        organizationId: "org_seed_stablebooks",
        customerId: "cus_seed_acme",
        referenceCode: "SB-SEED-APR26",
        publicToken: "pub_seed_invoice_apr_2026",
        amountMinor: 125000,
        currency: "USD",
        expectedChainId: 777,
        expectedToken: "USDC",
        dueAt: "2026-04-30T00:00:00.000Z",
        memo: "Arc-native receivables pilot invoice.",
        internalNote: "Seeded canonical invoice for Milestone 4 local testing.",
        status: "open",
        publishedAt: now,
        createdAt: now,
        updatedAt: now
      }
    ],
    payments: [
      {
        id: "pay_seed_apr_2026",
        organizationId: "org_seed_stablebooks",
        invoiceId: "inv_seed_apr_2026",
        publicToken: "pub_seed_invoice_apr_2026",
        status: "pending",
        matchResult: "pending",
        matchReason: null,
        observationId: null,
        amountMinor: 125000,
        currency: "USD",
        token: null,
        amountAtomic: null,
        decimals: null,
        chainId: null,
        txHash: null,
        blockNumber: null,
        fromAddress: null,
        toAddress: null,
        settlementReference: null,
        failureReason: null,
        confirmationSource: null,
        confirmationTxHash: null,
        confirmationBlockNumber: null,
        sourceConfirmedAt: null,
        confirmationReceivedAt: null,
        confirmedAt: null,
        startedAt: "2026-04-19T12:05:00.000Z",
        processingStartedAt: null,
        finalizedAt: null,
        createdAt: "2026-04-19T12:05:00.000Z",
        updatedAt: "2026-04-19T12:05:00.000Z"
      }
    ],
    paymentEvents: [
      {
        id: "evt_seed_payment_session_created",
        organizationId: "org_seed_stablebooks",
        invoiceId: "inv_seed_apr_2026",
        paymentId: "pay_seed_apr_2026",
        type: "payment_session_created",
        fromStatus: null,
        toStatus: "pending",
        note: "Seeded pending payment session for Milestone 4 local testing.",
        createdAt: "2026-04-19T12:05:00.000Z"
      }
    ],
    chainPaymentObservations: [],
    paymentMatches: [],
    webhookDeliveries: []
  };

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");

  console.log("Seeded JSON app store at apps/api/data/app-store.json");
  console.log("Login: operator@stablebooks.dev / stablebooks123");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
