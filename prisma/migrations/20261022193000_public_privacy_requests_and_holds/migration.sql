-- Forward-only addition; preserve the first review migration and all existing records.
ALTER TABLE "PrivacyRequest" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "PrivacyRequest" ADD COLUMN "encryptedContact" BYTEA;
ALTER TABLE "PrivacyRequest" ADD COLUMN "retentionHold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SecurityEvent" ADD COLUMN "retentionHold" BOOLEAN NOT NULL DEFAULT false;
