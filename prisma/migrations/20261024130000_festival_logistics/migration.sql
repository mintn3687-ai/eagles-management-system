CREATE TYPE "FestivalLogisticsStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED');

CREATE TABLE "FestivalLogisticsItem" (
    "id" TEXT NOT NULL,
    "festivalId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueAt" TIMESTAMP(3),
    "assignedMemberId" TEXT,
    "status" "FestivalLogisticsStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FestivalLogisticsItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FestivalLogisticsItem_festivalId_status_dueAt_id_idx"
    ON "FestivalLogisticsItem"("festivalId", "status", "dueAt", "id");
CREATE INDEX "FestivalLogisticsItem_assignedMemberId_festivalId_idx"
    ON "FestivalLogisticsItem"("assignedMemberId", "festivalId");
