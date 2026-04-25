-- AlterTable
ALTER TABLE "Session" ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "Session" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;
ALTER TABLE "Session" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "Membership" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;
ALTER TABLE "Membership" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "Invoice"
ADD COLUMN "expectedChainId" INTEGER,
ADD COLUMN "expectedToken" TEXT,
ADD COLUMN "expiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Payment"
ADD COLUMN "normalizedAmount" DECIMAL(30,12),
ADD COLUMN "logIndex" INTEGER,
ADD COLUMN "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ChainPaymentObservation"
ADD COLUMN "rawChainEventId" TEXT,
ADD COLUMN "logIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "PaymentEvent" ADD COLUMN "payload" JSONB;
ALTER TABLE "PaymentEvent" ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "PaymentEvent" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;
ALTER TABLE "PaymentEvent" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "WebhookDelivery" ADD COLUMN "endpointId" TEXT;

-- CreateTable
CREATE TABLE "RawChainEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "walletId" TEXT,
    "chainId" INTEGER NOT NULL,
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL DEFAULT 0,
    "blockNumber" INTEGER NOT NULL,
    "blockTimestamp" TIMESTAMP(3),
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "amountAtomic" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RawChainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "signingSecret" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Invoice_organizationId_status_idx" ON "Invoice"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_publicToken_key" ON "Payment"("publicToken");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_toAddress_idx" ON "Payment"("toAddress");

-- DropIndex
DROP INDEX "ChainPaymentObservation_chainId_txHash_key";

-- CreateIndex
CREATE UNIQUE INDEX "ChainPaymentObservation_rawChainEventId_key" ON "ChainPaymentObservation"("rawChainEventId");

-- CreateIndex
CREATE INDEX "ChainPaymentObservation_toAddress_idx" ON "ChainPaymentObservation"("toAddress");

-- CreateIndex
CREATE UNIQUE INDEX "ChainPaymentObservation_chainId_txHash_logIndex_key" ON "ChainPaymentObservation"("chainId", "txHash", "logIndex");

-- CreateIndex
CREATE INDEX "RawChainEvent_blockNumber_idx" ON "RawChainEvent"("blockNumber");

-- CreateIndex
CREATE INDEX "RawChainEvent_organizationId_observedAt_idx" ON "RawChainEvent"("organizationId", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RawChainEvent_chainId_txHash_logIndex_key" ON "RawChainEvent"("chainId", "txHash", "logIndex");

-- CreateIndex
CREATE INDEX "PaymentEvent_paymentId_createdAt_idx" ON "PaymentEvent"("paymentId", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_organizationId_isEnabled_idx" ON "WebhookEndpoint"("organizationId", "isEnabled");

-- CreateIndex
CREATE INDEX "WebhookDelivery_endpointId_status_idx" ON "WebhookDelivery"("endpointId", "status");

-- AddForeignKey
ALTER TABLE "ChainPaymentObservation" ADD CONSTRAINT "ChainPaymentObservation_rawChainEventId_fkey" FOREIGN KEY ("rawChainEventId") REFERENCES "RawChainEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawChainEvent" ADD CONSTRAINT "RawChainEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawChainEvent" ADD CONSTRAINT "RawChainEvent_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
