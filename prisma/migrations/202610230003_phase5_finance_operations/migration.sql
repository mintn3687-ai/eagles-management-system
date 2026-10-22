CREATE TYPE "FinanceEntryType" AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE "ReimbursementStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'PAID');
CREATE TYPE "FundraisingCampaignStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ContributionType" AS ENUM ('DONATION', 'SPONSORSHIP');
CREATE TYPE "ReconciliationStatus" AS ENUM ('OPEN', 'RECONCILED');

CREATE TABLE "Budget" (
  "id" TEXT NOT NULL,
  "seasonId" TEXT,
  "productionId" TEXT,
  "category" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Budget_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Budget_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "Budget_scope_check" CHECK ("seasonId" IS NOT NULL OR "productionId" IS NOT NULL),
  CONSTRAINT "Budget_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Budget_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Budget_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Budget_seasonId_category_idx" ON "Budget"("seasonId", "category");
CREATE INDEX "Budget_productionId_category_idx" ON "Budget"("productionId", "category");
CREATE INDEX "Budget_createdById_idx" ON "Budget"("createdById");

CREATE TABLE "FinanceEntry" (
  "id" TEXT NOT NULL,
  "type" "FinanceEntryType" NOT NULL,
  "category" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "receiptReference" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "seasonId" TEXT,
  "productionId" TEXT,
  "recordedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinanceEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinanceEntry_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "FinanceEntry_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinanceEntry_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinanceEntry_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "FinanceEntry_type_occurredAt_idx" ON "FinanceEntry"("type", "occurredAt");
CREATE INDEX "FinanceEntry_seasonId_type_occurredAt_idx" ON "FinanceEntry"("seasonId", "type", "occurredAt");
CREATE INDEX "FinanceEntry_productionId_type_occurredAt_idx" ON "FinanceEntry"("productionId", "type", "occurredAt");
CREATE INDEX "FinanceEntry_recordedById_idx" ON "FinanceEntry"("recordedById");

CREATE TABLE "Reimbursement" (
  "id" TEXT NOT NULL,
  "requestedByMemberId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "receiptReference" TEXT,
  "status" "ReimbursementStatus" NOT NULL DEFAULT 'REQUESTED',
  "approvedById" TEXT,
  "decidedAt" TIMESTAMP(3),
  "paidById" TEXT,
  "paidAt" TIMESTAMP(3),
  "paymentReference" TEXT,
  "seasonId" TEXT,
  "productionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Reimbursement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Reimbursement_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "Reimbursement_lifecycle_check" CHECK (
    ("status" = 'REQUESTED' AND "approvedById" IS NULL AND "decidedAt" IS NULL AND "paidById" IS NULL AND "paidAt" IS NULL)
    OR ("status" IN ('APPROVED', 'REJECTED') AND "approvedById" IS NOT NULL AND "decidedAt" IS NOT NULL AND "paidById" IS NULL AND "paidAt" IS NULL)
    OR ("status" = 'PAID' AND "approvedById" IS NOT NULL AND "decidedAt" IS NOT NULL AND "paidById" IS NOT NULL AND "paidAt" IS NOT NULL AND "paymentReference" IS NOT NULL)
  ),
  CONSTRAINT "Reimbursement_requestedByMemberId_fkey" FOREIGN KEY ("requestedByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Reimbursement_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Reimbursement_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Reimbursement_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Reimbursement_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Reimbursement_status_createdAt_idx" ON "Reimbursement"("status", "createdAt");
CREATE INDEX "Reimbursement_requestedByMemberId_status_idx" ON "Reimbursement"("requestedByMemberId", "status");
CREATE INDEX "Reimbursement_seasonId_status_idx" ON "Reimbursement"("seasonId", "status");
CREATE INDEX "Reimbursement_productionId_status_idx" ON "Reimbursement"("productionId", "status");
CREATE INDEX "Reimbursement_approvedById_idx" ON "Reimbursement"("approvedById");
CREATE INDEX "Reimbursement_paidById_idx" ON "Reimbursement"("paidById");

CREATE TABLE "FundraisingCampaign" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "goalAmount" INTEGER NOT NULL,
  "status" "FundraisingCampaignStatus" NOT NULL DEFAULT 'ACTIVE',
  "seasonId" TEXT,
  "productionId" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FundraisingCampaign_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FundraisingCampaign_goalAmount_check" CHECK ("goalAmount" > 0),
  CONSTRAINT "FundraisingCampaign_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FundraisingCampaign_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FundraisingCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "FundraisingCampaign_status_createdAt_idx" ON "FundraisingCampaign"("status", "createdAt");
CREATE INDEX "FundraisingCampaign_seasonId_status_idx" ON "FundraisingCampaign"("seasonId", "status");
CREATE INDEX "FundraisingCampaign_productionId_status_idx" ON "FundraisingCampaign"("productionId", "status");
CREATE INDEX "FundraisingCampaign_createdById_idx" ON "FundraisingCampaign"("createdById");

CREATE TABLE "Contribution" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT,
  "type" "ContributionType" NOT NULL,
  "contributor" TEXT,
  "amount" INTEGER NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "reference" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "seasonId" TEXT,
  "productionId" TEXT,
  "recordedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Contribution_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Contribution_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "Contribution_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "FundraisingCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Contribution_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Contribution_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Contribution_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Contribution_type_receivedAt_idx" ON "Contribution"("type", "receivedAt");
CREATE INDEX "Contribution_campaignId_receivedAt_idx" ON "Contribution"("campaignId", "receivedAt");
CREATE INDEX "Contribution_seasonId_receivedAt_idx" ON "Contribution"("seasonId", "receivedAt");
CREATE INDEX "Contribution_productionId_receivedAt_idx" ON "Contribution"("productionId", "receivedAt");
CREATE INDEX "Contribution_recordedById_idx" ON "Contribution"("recordedById");

CREATE TABLE "TicketType" (
  "id" TEXT NOT NULL,
  "showDateId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "price" INTEGER NOT NULL,
  "quantityAvailable" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TicketType_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TicketType_price_check" CHECK ("price" >= 0),
  CONSTRAINT "TicketType_quantityAvailable_check" CHECK ("quantityAvailable" IS NULL OR "quantityAvailable" > 0),
  CONSTRAINT "TicketType_showDateId_fkey" FOREIGN KEY ("showDateId") REFERENCES "ShowDate"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TicketType_showDateId_name_key" ON "TicketType"("showDateId", "name");
CREATE INDEX "TicketType_showDateId_createdAt_idx" ON "TicketType"("showDateId", "createdAt");

CREATE TABLE "TicketSale" (
  "id" TEXT NOT NULL,
  "ticketTypeId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" INTEGER NOT NULL,
  "totalAmount" INTEGER NOT NULL,
  "buyerName" TEXT,
  "method" "PaymentMethod" NOT NULL,
  "reference" TEXT,
  "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recordedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TicketSale_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TicketSale_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "TicketSale_amount_check" CHECK ("unitPrice" >= 0 AND "totalAmount" >= 0 AND "totalAmount"::BIGINT = "unitPrice"::BIGINT * "quantity"::BIGINT),
  CONSTRAINT "TicketSale_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TicketSale_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "TicketSale_ticketTypeId_soldAt_idx" ON "TicketSale"("ticketTypeId", "soldAt");
CREATE INDEX "TicketSale_method_soldAt_idx" ON "TicketSale"("method", "soldAt");
CREATE INDEX "TicketSale_recordedById_idx" ON "TicketSale"("recordedById");

CREATE TABLE "TicketRefund" (
  "id" TEXT NOT NULL,
  "ticketSaleId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "refundedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recordedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TicketRefund_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TicketRefund_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "TicketRefund_ticketSaleId_fkey" FOREIGN KEY ("ticketSaleId") REFERENCES "TicketSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TicketRefund_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "TicketRefund_ticketSaleId_refundedAt_idx" ON "TicketRefund"("ticketSaleId", "refundedAt");

CREATE TABLE "GuestListEntry" (
  "id" TEXT NOT NULL,
  "showDateId" TEXT NOT NULL,
  "ticketSaleId" TEXT,
  "name" TEXT NOT NULL,
  "note" TEXT,
  "checkedInAt" TIMESTAMP(3),
  "addedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuestListEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GuestListEntry_showDateId_fkey" FOREIGN KEY ("showDateId") REFERENCES "ShowDate"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GuestListEntry_ticketSaleId_fkey" FOREIGN KEY ("ticketSaleId") REFERENCES "TicketSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GuestListEntry_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "GuestListEntry_showDateId_checkedInAt_idx" ON "GuestListEntry"("showDateId", "checkedInAt");
CREATE INDEX "GuestListEntry_ticketSaleId_idx" ON "GuestListEntry"("ticketSaleId");
CREATE INDEX "GuestListEntry_addedById_idx" ON "GuestListEntry"("addedById");

CREATE TABLE "ReconciliationBatch" (
  "id" TEXT NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "statementDate" TIMESTAMP(3) NOT NULL,
  "reference" TEXT NOT NULL,
  "status" "ReconciliationStatus" NOT NULL DEFAULT 'OPEN',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReconciliationBatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReconciliationBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ReconciliationBatch_method_reference_key" ON "ReconciliationBatch"("method", "reference");
CREATE INDEX "ReconciliationBatch_status_statementDate_idx" ON "ReconciliationBatch"("status", "statementDate");
CREATE INDEX "ReconciliationBatch_createdById_idx" ON "ReconciliationBatch"("createdById");

CREATE TABLE "ReconciliationEntry" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "statementReference" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "paymentId" TEXT,
  "ticketSaleId" TEXT,
  "notes" TEXT,
  "matchedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReconciliationEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReconciliationEntry_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "ReconciliationEntry_match_check" CHECK (
    NOT ("paymentId" IS NOT NULL AND "ticketSaleId" IS NOT NULL)
    AND (("paymentId" IS NOT NULL OR "ticketSaleId" IS NOT NULL) = ("matchedAt" IS NOT NULL))
  ),
  CONSTRAINT "ReconciliationEntry_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ReconciliationBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ReconciliationEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ReconciliationEntry_ticketSaleId_fkey" FOREIGN KEY ("ticketSaleId") REFERENCES "TicketSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ReconciliationEntry_paymentId_key" ON "ReconciliationEntry"("paymentId");
CREATE UNIQUE INDEX "ReconciliationEntry_ticketSaleId_key" ON "ReconciliationEntry"("ticketSaleId");
CREATE UNIQUE INDEX "ReconciliationEntry_batchId_statementReference_key" ON "ReconciliationEntry"("batchId", "statementReference");
CREATE INDEX "ReconciliationEntry_batchId_paymentId_idx" ON "ReconciliationEntry"("batchId", "paymentId");
