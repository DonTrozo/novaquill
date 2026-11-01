-- Additive only. Existing/OAuth accounts remain unaccepted until an explicit action.
ALTER TABLE "User" ADD COLUMN "termsAcceptedVersion" TEXT,
                   ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD CONSTRAINT "User_terms_acceptance_pair"
CHECK (("termsAcceptedVersion" IS NULL) = ("termsAcceptedAt" IS NULL));
