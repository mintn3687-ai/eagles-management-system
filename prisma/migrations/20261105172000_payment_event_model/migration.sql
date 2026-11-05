CREATE TYPE "PaymentEventStatus" AS ENUM ('OPEN', 'CLOSED');

CREATE TABLE "PaymentEvent" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "paymentDeadline" TIMESTAMP(3),
  "status" "PaymentEventStatus" NOT NULL DEFAULT 'OPEN',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentEvent_createdById_fkey" FOREIGN KEY ("createdById")
    REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "Payment"
ADD COLUMN "paymentEventId" TEXT,
ADD CONSTRAINT "Payment_paymentEventId_fkey" FOREIGN KEY ("paymentEventId")
  REFERENCES "PaymentEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "Payment_event_link_check" CHECK (
  ("type" = 'EVENT' AND "paymentEventId" IS NOT NULL)
  OR ("type" <> 'EVENT' AND "paymentEventId" IS NULL)
);

CREATE INDEX "PaymentEvent_status_paymentDeadline_createdAt_idx"
ON "PaymentEvent"("status", "paymentDeadline", "createdAt");

CREATE INDEX "Payment_paymentEventId_status_memberId_idx"
ON "Payment"("paymentEventId", "status", "memberId");
