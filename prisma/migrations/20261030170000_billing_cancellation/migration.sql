-- Additive subscription evidence; existing paid accounts derive their period from their last payment.
ALTER TABLE "User" ADD COLUMN "payfastSubscriptionToken" BYTEA;
ALTER TABLE "User" ADD COLUMN "payfastSubscriptionIdHash" TEXT;
CREATE UNIQUE INDEX "User_payfastSubscriptionIdHash_key" ON "User"("payfastSubscriptionIdHash");
ALTER TABLE "User" ADD COLUMN "subscriptionPaidThroughAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "subscriptionCancelledAt" TIMESTAMP(3);
CREATE TABLE "BillingRequest" (
 "id" TEXT NOT NULL, "userId" TEXT, "kind" TEXT NOT NULL,
 "encryptedContact" BYTEA NOT NULL, "encryptedMessage" BYTEA NOT NULL,
 "encryptedOutcome" BYTEA, "status" TEXT NOT NULL DEFAULT 'OPEN',
 "retentionHold" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "resolvedAt" TIMESTAMP(3), "notifiedAt" TIMESTAMP(3),
 CONSTRAINT "BillingRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BillingRequest_userId_createdAt_idx" ON "BillingRequest"("userId", "createdAt");
CREATE INDEX "BillingRequest_status_createdAt_idx" ON "BillingRequest"("status", "createdAt");
ALTER TABLE "BillingRequest" ADD CONSTRAINT "BillingRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
