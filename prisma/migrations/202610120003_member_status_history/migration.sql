CREATE TABLE "MemberStatusHistory" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "status" "MemberStatus" NOT NULL,
  "effectiveAt" TIMESTAMP(3) NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MemberStatusHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MemberStatusHistory_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "MemberStatusHistory_memberId_effectiveAt_recordedAt_id_idx"
  ON "MemberStatusHistory"("memberId", "effectiveAt", "recordedAt", "id");
CREATE INDEX "MemberStatusHistory_status_effectiveAt_idx"
  ON "MemberStatusHistory"("status", "effectiveAt");

WITH member_creation AS (
  SELECT DISTINCT ON ("entityId") "entityId", "createdAt", "details"
  FROM "AuditLog"
  WHERE "entity" = 'Member' AND "action" = 'MEMBER_CREATED'
  ORDER BY "entityId", "createdAt", "id"
), first_registration AS (
  SELECT "memberId", MIN("paidAt") AS "paidAt"
  FROM "Payment"
  WHERE "type" = 'REGISTRATION' AND "status" = 'SUCCESS' AND "paidAt" IS NOT NULL
  GROUP BY "memberId"
)
INSERT INTO "MemberStatusHistory" ("id", "memberId", "status", "effectiveAt")
SELECT
  'status-backfill-' || m."id",
  m."id",
  CASE
    WHEN c."entityId" IS NOT NULL AND c."details"->>'existingMember' = 'true' THEN 'ACTIVE'::"MemberStatus"
    WHEN c."entityId" IS NOT NULL THEN 'PENDING_REGISTRATION'::"MemberStatus"
    WHEN r."paidAt" IS NOT NULL THEN 'PENDING_REGISTRATION'::"MemberStatus"
    ELSE m."status"
  END,
  CASE
    WHEN c."entityId" IS NOT NULL THEN c."createdAt"
    WHEN r."paidAt" IS NOT NULL THEN m."createdAt"
    WHEN m."status" = 'ACTIVE' THEN LEAST(m."createdAt", m."joinedAt")
    ELSE m."createdAt"
  END
FROM "Member" m
LEFT JOIN member_creation c ON c."entityId" = m."id"
LEFT JOIN first_registration r ON r."memberId" = m."id";

INSERT INTO "MemberStatusHistory" ("id", "memberId", "status", "effectiveAt")
SELECT 'status-audit-' || a."id", a."entityId", (a."details"->>'to')::"MemberStatus", a."createdAt"
FROM "AuditLog" a
WHERE a."entity" = 'Member'
  AND a."action" = 'MEMBER_STATUS_CHANGED'
  AND a."details"->>'to' IN ('PENDING_REGISTRATION', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'ALUMNI');

INSERT INTO "MemberStatusHistory" ("id", "memberId", "status", "effectiveAt")
SELECT 'status-payment-' || p."id", p."memberId", 'ACTIVE'::"MemberStatus", p."paidAt"
FROM "Payment" p
WHERE p."type" = 'REGISTRATION' AND p."status" = 'SUCCESS' AND p."paidAt" IS NOT NULL;
