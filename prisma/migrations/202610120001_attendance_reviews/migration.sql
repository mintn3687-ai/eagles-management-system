DROP INDEX IF EXISTS "Rehearsal_checkInCode_key";
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "wrongCodeTries" INTEGER NOT NULL DEFAULT 0;
UPDATE "Attendance" SET "reviewStatus" = 'PENDING' WHERE "status" IN ('ABSENT', 'NO_RESPONSE') AND "reviewStatus" = 'NONE';
CREATE INDEX "Attendance_reviewStatus_status_markedAt_id_idx" ON "Attendance"("reviewStatus", "status", "markedAt", "id");
