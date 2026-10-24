CREATE TYPE "FestivalInvitationStatus" AS ENUM ('RECEIVED', 'ACCEPTED', 'DECLINED');
CREATE TYPE "FestivalEntryStatus" AS ENUM ('PENDING', 'PREPARING', 'SUBMITTED', 'CONFIRMED', 'REJECTED');

CREATE TABLE "FestivalInvitation" (
    "id" TEXT NOT NULL,
    "festivalId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "responseDeadline" TIMESTAMP(3),
    "status" "FestivalInvitationStatus" NOT NULL DEFAULT 'RECEIVED',
    "respondedAt" TIMESTAMP(3),
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FestivalInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FestivalEntryCategory" (
    "id" TEXT NOT NULL,
    "festivalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultDeadline" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FestivalEntryCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FestivalEntry" (
    "id" TEXT NOT NULL,
    "festivalId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "productionId" TEXT,
    "itemTitle" TEXT NOT NULL,
    "status" "FestivalEntryStatus" NOT NULL DEFAULT 'PENDING',
    "deadline" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FestivalEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FestivalEntryCategory_festivalId_name_key" ON "FestivalEntryCategory"("festivalId", "name");
CREATE INDEX "FestivalInvitation_festivalId_status_receivedAt_idx" ON "FestivalInvitation"("festivalId", "status", "receivedAt");
CREATE INDEX "FestivalInvitation_responseDeadline_status_idx" ON "FestivalInvitation"("responseDeadline", "status");
CREATE INDEX "FestivalInvitation_recordedById_idx" ON "FestivalInvitation"("recordedById");
CREATE INDEX "FestivalEntryCategory_festivalId_defaultDeadline_idx" ON "FestivalEntryCategory"("festivalId", "defaultDeadline");
CREATE INDEX "FestivalEntryCategory_createdById_idx" ON "FestivalEntryCategory"("createdById");
CREATE INDEX "FestivalEntry_festivalId_status_deadline_idx" ON "FestivalEntry"("festivalId", "status", "deadline");
CREATE INDEX "FestivalEntry_categoryId_idx" ON "FestivalEntry"("categoryId");
CREATE INDEX "FestivalEntry_productionId_idx" ON "FestivalEntry"("productionId");
CREATE INDEX "FestivalEntry_createdById_idx" ON "FestivalEntry"("createdById");
