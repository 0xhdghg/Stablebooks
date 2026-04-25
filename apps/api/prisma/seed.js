const path = require("node:path");
const { scryptSync } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");

if (!process.env.DATABASE_URL && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(path.resolve(__dirname, "..", ".env"));
}

const prisma = new PrismaClient();

const ids = {
  user: "usr_seed_operator",
  session: "ses_seed_operator",
  smokeSession: "ses_seed_operator_smoke",
  organization: "org_seed_stablebooks",
  membership: "mbr_seed_operator_admin",
  wallet: "wal_seed_arc_collection",
  customer: "cus_seed_acme",
  invoice: "inv_seed_apr_2026",
  payment: "pay_seed_apr_2026",
  webhookEndpoint: "whend_seed_disabled"
};

function hashPassword(password) {
  const salt = "stablebooks-seed-salt";
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  await prisma.webhookDelivery.deleteMany();
  await prisma.webhookEndpoint.deleteMany();
  await prisma.paymentEvent.deleteMany();
  await prisma.paymentMatch.deleteMany();
  await prisma.chainPaymentObservation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.session.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.create({
    data: {
      id: ids.user,
      email: "operator@stablebooks.dev",
      name: "Stablebooks Operator",
      passwordHash: hashPassword("stablebooks123")
    }
  });

  await prisma.session.createMany({
    data: [
      {
        id: ids.session,
        token: "sb_seed_operator_token",
        userId: ids.user
      },
      {
        id: ids.smokeSession,
        token: "sb_6a83a3316556e3139feb1f6833fc93e543e79e495d0ef484",
        userId: ids.user
      }
    ]
  });

  await prisma.organization.create({
    data: {
      id: ids.organization,
      name: "Stablebooks Demo Org",
      billingCountry: "US",
      baseCurrency: "USD",
      onboardingStatus: "completed"
    }
  });

  await prisma.membership.create({
    data: {
      id: ids.membership,
      userId: ids.user,
      organizationId: ids.organization,
      role: "admin"
    }
  });

  await prisma.wallet.create({
    data: {
      id: ids.wallet,
      organizationId: ids.organization,
      chain: "arc",
      address: "0x1111111111111111111111111111111111111111",
      label: "Primary Arc Collection",
      role: "collection",
      isDefaultSettlement: true,
      status: "active"
    }
  });

  await prisma.customer.create({
    data: {
      id: ids.customer,
      organizationId: ids.organization,
      name: "Acme Treasury",
      email: "ap@acme.dev",
      billingCurrency: "USD",
      metadataJson: {
        segment: "design-partner",
        source: "milestone-4-seed"
      }
    }
  });

  await prisma.invoice.create({
    data: {
      id: ids.invoice,
      organizationId: ids.organization,
      customerId: ids.customer,
      publicToken: "pub_seed_invoice_apr_2026",
      referenceCode: "SB-SEED-APR26",
      amountMinor: 125000,
      currency: "USD",
      expectedChainId: 777,
      expectedToken: "USDC",
      dueAt: new Date("2026-04-30T00:00:00.000Z"),
      memo: "Arc-native receivables pilot invoice.",
      internalNote: "Seeded canonical invoice for Milestone 4 local testing.",
      status: "open",
      publishedAt: new Date("2026-04-19T12:00:00.000Z")
    }
  });

  await prisma.payment.create({
    data: {
      id: ids.payment,
      organizationId: ids.organization,
      invoiceId: ids.invoice,
      publicToken: "pub_seed_invoice_apr_2026",
      status: "pending",
      matchResult: "pending",
      amountMinor: 125000,
      currency: "USD",
      startedAt: new Date("2026-04-19T12:05:00.000Z")
    }
  });

  await prisma.paymentEvent.create({
    data: {
      id: "evt_seed_payment_session_created",
      organizationId: ids.organization,
      invoiceId: ids.invoice,
      paymentId: ids.payment,
      type: "payment_session_created",
      toStatus: "pending",
      note: "Seeded pending payment session for Day 6 Postgres read testing.",
      payload: {
        source: "postgres-seed",
        purpose: "day-6-ui-read-parity"
      }
    }
  });

  await prisma.webhookEndpoint.create({
    data: {
      id: ids.webhookEndpoint,
      organizationId: ids.organization,
      url: "https://webhooks.example.invalid/stablebooks",
      signingSecret: "seed-disabled-webhook-secret",
      isEnabled: false
    }
  });

  console.log("Seeded Stablebooks Day 6 Postgres UI-read parity data.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
