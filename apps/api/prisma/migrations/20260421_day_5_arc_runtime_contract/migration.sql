-- AlterTable
ALTER TABLE "Payment"
ADD COLUMN "confirmationTxHash" TEXT,
ADD COLUMN "confirmationBlockNumber" INTEGER,
ADD COLUMN "sourceConfirmedAt" TIMESTAMP(3),
ADD COLUMN "confirmationReceivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RawChainEvent"
ADD COLUMN "sourceConfirmedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ChainPaymentObservation"
ADD COLUMN "sourceConfirmedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WebhookDelivery"
ADD COLUMN "eventId" TEXT,
ADD COLUMN "eventCreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "paymentStatusSnapshot" "PaymentStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN "invoiceStatusSnapshot" "InvoiceStatus" NOT NULL DEFAULT 'open',
ADD COLUMN "replayOfDeliveryId" TEXT;

-- Backfill existing delivery audit identity from the delivery row itself.
UPDATE "WebhookDelivery"
SET "eventId" = "id",
    "eventCreatedAt" = "createdAt"
WHERE "eventId" IS NULL;

ALTER TABLE "WebhookDelivery" ALTER COLUMN "eventId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "WebhookDelivery_eventId_idx" ON "WebhookDelivery"("eventId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_replayOfDeliveryId_idx" ON "WebhookDelivery"("replayOfDeliveryId");
