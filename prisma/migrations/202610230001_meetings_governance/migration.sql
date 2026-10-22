CREATE TYPE "MeetingStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "MinutesStatus" AS ENUM ('DRAFT', 'APPROVED');
CREATE TYPE "MotionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DEFERRED');
CREATE TYPE "ActionItemStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TABLE "Meeting" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "venue" TEXT NOT NULL,
  "status" "MeetingStatus" NOT NULL DEFAULT 'DRAFT',
  "quorumPercent" INTEGER NOT NULL DEFAULT 50,
  "quorumEligibleCount" INTEGER NOT NULL DEFAULT 0,
  "minutes" TEXT,
  "minutesStatus" "MinutesStatus" NOT NULL DEFAULT 'DRAFT',
  "minutesApprovedAt" TIMESTAMP(3),
  "minutesApprovedById" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Meeting_quorumPercent_check" CHECK ("quorumPercent" BETWEEN 1 AND 100),
  CONSTRAINT "Meeting_quorumEligibleCount_check" CHECK ("quorumEligibleCount" >= 0),
  CONSTRAINT "Meeting_minutes_approval_check"
    CHECK (("minutesStatus" = 'DRAFT' AND "minutesApprovedAt" IS NULL AND "minutesApprovedById" IS NULL)
      OR ("minutesStatus" = 'APPROVED' AND "minutesApprovedAt" IS NOT NULL AND "minutesApprovedById" IS NOT NULL)),
  CONSTRAINT "Meeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Meeting_minutesApprovedById_fkey" FOREIGN KEY ("minutesApprovedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Meeting_status_startsAt_id_idx" ON "Meeting"("status", "startsAt", "id");
CREATE INDEX "Meeting_minutesStatus_startsAt_id_idx" ON "Meeting"("minutesStatus", "startsAt", "id");
CREATE INDEX "Meeting_createdById_idx" ON "Meeting"("createdById");
CREATE INDEX "Meeting_minutesApprovedById_idx" ON "Meeting"("minutesApprovedById");

CREATE TABLE "MeetingAgendaItem" (
  "id" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeetingAgendaItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MeetingAgendaItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "MeetingAgendaItem_meetingId_sortOrder_id_idx" ON "MeetingAgendaItem"("meetingId", "sortOrder", "id");

CREATE TABLE "MeetingAttendance" (
  "id" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "attended" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeetingAttendance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MeetingAttendance_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MeetingAttendance_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MeetingAttendance_meetingId_memberId_key" ON "MeetingAttendance"("meetingId", "memberId");
CREATE INDEX "MeetingAttendance_meetingId_attended_memberId_idx" ON "MeetingAttendance"("meetingId", "attended", "memberId");
CREATE INDEX "MeetingAttendance_memberId_meetingId_idx" ON "MeetingAttendance"("memberId", "meetingId");

CREATE TABLE "Motion" (
  "id" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "MotionStatus" NOT NULL DEFAULT 'PENDING',
  "decisionNote" TEXT,
  "decidedAt" TIMESTAMP(3),
  "decidedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Motion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Motion_decision_check"
    CHECK (("status" = 'PENDING' AND "decidedAt" IS NULL AND "decidedById" IS NULL)
      OR ("status" <> 'PENDING' AND "decidedAt" IS NOT NULL AND "decidedById" IS NOT NULL)),
  CONSTRAINT "Motion_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Motion_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Motion_meetingId_status_createdAt_idx" ON "Motion"("meetingId", "status", "createdAt");
CREATE INDEX "Motion_decidedById_idx" ON "Motion"("decidedById");

CREATE TABLE "MeetingActionItem" (
  "id" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "ownerMemberId" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3),
  "status" "ActionItemStatus" NOT NULL DEFAULT 'OPEN',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeetingActionItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MeetingActionItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MeetingActionItem_ownerMemberId_fkey" FOREIGN KEY ("ownerMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MeetingActionItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "MeetingActionItem_meetingId_status_dueAt_idx" ON "MeetingActionItem"("meetingId", "status", "dueAt");
CREATE INDEX "MeetingActionItem_ownerMemberId_status_dueAt_idx" ON "MeetingActionItem"("ownerMemberId", "status", "dueAt");
CREATE INDEX "MeetingActionItem_createdById_idx" ON "MeetingActionItem"("createdById");
