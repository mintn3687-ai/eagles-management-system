CREATE TYPE "FestivalStatus" AS ENUM ('DRAFT', 'PLANNING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

CREATE TABLE "Festival" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "organizer" TEXT,
    "venue" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "FestivalStatus" NOT NULL DEFAULT 'PLANNING',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Festival_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Festival_year_status_startDate_idx" ON "Festival"("year", "status", "startDate");
CREATE INDEX "Festival_name_year_idx" ON "Festival"("name", "year");
CREATE INDEX "Festival_createdById_idx" ON "Festival"("createdById");
