CREATE INDEX "Payment_type_status_memberId_paidAt_id_idx"
ON "Payment" ("type", "status", "memberId", "paidAt" DESC, "id" DESC);

CREATE INDEX "AuditLog_createdAt_id_idx"
ON "AuditLog" ("createdAt" DESC, "id" DESC);

CREATE INDEX "AuditLog_action_idx" ON "AuditLog" ("action");
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog" ("entityId");
CREATE INDEX "User_name_idx" ON "User" ("name");
