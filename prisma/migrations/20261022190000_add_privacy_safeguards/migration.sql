-- Additive only. Apply to an isolated test database before approval for production.
CREATE TABLE "SecurityEvent" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "targetId" TEXT,
  "digest" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SecurityEvent_actorId_createdAt_idx" ON "SecurityEvent"("actorId", "createdAt");
CREATE INDEX "SecurityEvent_createdAt_idx" ON "SecurityEvent"("createdAt");
CREATE TABLE "PrivacyRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "encryptedMessage" BYTEA NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "notifiedAt" TIMESTAMP(3),
  "encryptedOutcome" BYTEA,
  CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PrivacyRequest_userId_createdAt_idx" ON "PrivacyRequest"("userId", "createdAt");
CREATE INDEX "PrivacyRequest_status_createdAt_idx" ON "PrivacyRequest"("status", "createdAt");
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
