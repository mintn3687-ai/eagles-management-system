CREATE UNIQUE INDEX "Member_email_key" ON "Member"("email");
CREATE INDEX "Member_fullName_id_idx" ON "Member"("fullName", "id");
CREATE INDEX "Member_joinedAt_id_idx" ON "Member"("joinedAt", "id");
CREATE INDEX "Member_status_joinedAt_id_idx" ON "Member"("status", "joinedAt", "id");
