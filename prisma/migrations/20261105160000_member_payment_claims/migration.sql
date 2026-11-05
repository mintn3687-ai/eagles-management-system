ALTER TYPE "FeeType" ADD VALUE 'RETREAT_BONDING';
ALTER TYPE "PaymentType" ADD VALUE 'RETREAT_BONDING';

CREATE TYPE "PaymentSource" AS ENUM ('ADMIN_MANUAL', 'MEMBER_REPORTED', 'PROVIDER_VERIFIED');

ALTER TABLE "Payment"
ADD COLUMN "source" "PaymentSource" NOT NULL DEFAULT 'ADMIN_MANUAL',
ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");
CREATE INDEX "Payment_memberId_source_status_createdAt_idx"
ON "Payment"("memberId", "source", "status", "createdAt" DESC);
