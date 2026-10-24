CREATE TYPE "FestivalBudgetType" AS ENUM ('INCOME', 'EXPENSE');

CREATE TABLE "FestivalBudgetItem" (
    "id" TEXT NOT NULL,
    "festivalId" TEXT NOT NULL,
    "type" "FestivalBudgetType" NOT NULL,
    "category" TEXT NOT NULL,
    "plannedAmount" INTEGER NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FestivalBudgetItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FestivalFinanceLink" (
    "id" TEXT NOT NULL,
    "festivalId" TEXT NOT NULL,
    "budgetItemId" TEXT NOT NULL,
    "financeEntryId" TEXT NOT NULL,
    "linkedById" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FestivalFinanceLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FestivalFinanceLink_financeEntryId_key" ON "FestivalFinanceLink"("financeEntryId");
CREATE INDEX "FestivalBudgetItem_festivalId_type_category_idx" ON "FestivalBudgetItem"("festivalId", "type", "category");
CREATE INDEX "FestivalBudgetItem_createdById_idx" ON "FestivalBudgetItem"("createdById");
CREATE INDEX "FestivalFinanceLink_festivalId_budgetItemId_idx" ON "FestivalFinanceLink"("festivalId", "budgetItemId");
CREATE INDEX "FestivalFinanceLink_linkedById_idx" ON "FestivalFinanceLink"("linkedById");
