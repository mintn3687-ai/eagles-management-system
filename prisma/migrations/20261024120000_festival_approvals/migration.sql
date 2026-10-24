CREATE TYPE "FestivalApprovalType" AS ENUM ('PLAN', 'BUDGET');
CREATE TYPE "FestivalApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "FestivalApproval" (
    "id" TEXT NOT NULL,
    "festivalId" TEXT NOT NULL,
    "budgetItemId" TEXT,
    "targetKey" TEXT NOT NULL,
    "type" "FestivalApprovalType" NOT NULL,
    "status" "FestivalApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAmount" INTEGER,
    "approvedAmount" INTEGER,
    "submittedById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FestivalApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FestivalApproval_targetKey_key" ON "FestivalApproval"("targetKey");
CREATE INDEX "FestivalApproval_festivalId_type_status_idx" ON "FestivalApproval"("festivalId", "type", "status");
CREATE INDEX "FestivalApproval_budgetItemId_status_idx" ON "FestivalApproval"("budgetItemId", "status");
CREATE INDEX "FestivalApproval_submittedById_idx" ON "FestivalApproval"("submittedById");
CREATE INDEX "FestivalApproval_decidedById_idx" ON "FestivalApproval"("decidedById");
