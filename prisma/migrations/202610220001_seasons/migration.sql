CREATE TYPE "SeasonMembershipStatus" AS ENUM (
  'PENDING_REGISTRATION',
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'ALUMNI'
);

CREATE TABLE "Season" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "isCurrent" BOOLEAN NOT NULL DEFAULT false,
  "membershipSnapshotHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Season_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Season_dates_check" CHECK ("endDate" >= "startDate")
);

CREATE UNIQUE INDEX "Season_one_current_idx"
  ON "Season" ("isCurrent")
  WHERE "isCurrent" = true;
CREATE INDEX "Season_startDate_endDate_idx" ON "Season"("startDate", "endDate");

CREATE TABLE "SeasonMembership" (
  "id" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "status" "SeasonMembershipStatus" NOT NULL,
  "feesOwed" INTEGER NOT NULL DEFAULT 0,
  "feesPaid" INTEGER NOT NULL DEFAULT 0,
  "roleInSeason" TEXT NOT NULL DEFAULT 'MEMBER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeasonMembership_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SeasonMembership_feesOwed_nonnegative" CHECK ("feesOwed" >= 0),
  CONSTRAINT "SeasonMembership_feesPaid_nonnegative" CHECK ("feesPaid" >= 0),
  CONSTRAINT "SeasonMembership_seasonId_fkey"
    FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SeasonMembership_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SeasonMembership_seasonId_memberId_key"
  ON "SeasonMembership"("seasonId", "memberId");
CREATE INDEX "SeasonMembership_seasonId_status_memberId_idx"
  ON "SeasonMembership"("seasonId", "status", "memberId");
CREATE INDEX "SeasonMembership_memberId_seasonId_idx"
  ON "SeasonMembership"("memberId", "seasonId");

ALTER TABLE "Payment" ADD COLUMN "seasonId" TEXT;
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_seasonId_fkey"
  FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Payment_seasonId_status_type_paidAt_idx"
  ON "Payment"("seasonId", "status", "type", "paidAt");

INSERT INTO "Season" ("id", "name", "startDate", "endDate", "isCurrent")
VALUES (
  'season-2026',
  '2026 Drama Club Season',
  TIMESTAMP '2025-12-31 21:00:00',
  TIMESTAMP '2026-12-30 21:00:00',
  true
);

UPDATE "Payment"
SET "seasonId" = 'season-2026'
WHERE "paidAt" >= TIMESTAMP '2025-12-31 21:00:00'
  AND "paidAt" < TIMESTAMP '2026-12-31 21:00:00';

INSERT INTO "SeasonMembership"
  ("id", "seasonId", "memberId", "status", "feesOwed", "feesPaid", "roleInSeason")
SELECT
  'season-2026-' || m."id",
  'season-2026',
  m."id",
  m."status"::text::"SeasonMembershipStatus",
  0,
  COALESCE(SUM(p."amount") FILTER (
    WHERE p."status" = 'SUCCESS'::"PaymentStatus"
  ), 0)::integer,
  'MEMBER'
FROM "Member" m
LEFT JOIN "Payment" p ON p."memberId" = m."id" AND p."seasonId" = 'season-2026'
GROUP BY m."id", m."status";
