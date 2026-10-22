-- CreateEnum
CREATE TYPE "ProductionStatus" AS ENUM ('PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductionTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CastingType" AS ENUM ('CAST', 'UNDERSTUDY');

-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('PROP', 'COSTUME', 'EQUIPMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetCondition" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'NEEDS_REPAIR');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('AVAILABLE', 'CHECKED_OUT', 'RETIRED');

-- AlterTable
ALTER TABLE "Attendance" ALTER COLUMN "markedBy" SET DEFAULT 'SELF';

-- AlterTable
ALTER TABLE "Ballot" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "BallotChoice" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Election" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "EligibleVoter" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Meeting" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MeetingActionItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MeetingAgendaItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MeetingAttendance" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Motion" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Nomination" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Office" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Rehearsal" ADD COLUMN     "productionId" TEXT;

-- AlterTable
ALTER TABLE "Season" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SeasonMembership" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VoteReceipt" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Production" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProductionStatus" NOT NULL DEFAULT 'PLANNING',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "seasonId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Production_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScriptVersion" (
    "id" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "usageRightsNotes" TEXT NOT NULL,
    "storageReference" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScriptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionRole" (
    "id" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Casting" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "type" "CastingType" NOT NULL DEFAULT 'CAST',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Casting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrewAssignment" (
    "id" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "assignment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrewAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionTask" (
    "id" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "ownerMemberId" TEXT,
    "deadline" TIMESTAMP(3),
    "status" "ProductionTaskStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShowDate" (
    "id" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "venue" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShowDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallSheet" (
    "id" TEXT NOT NULL,
    "showDateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "callAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallSheetMember" (
    "id" TEXT NOT NULL,
    "callSheetId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallSheetMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "productionId" TEXT,
    "name" TEXT NOT NULL,
    "category" "AssetCategory" NOT NULL,
    "condition" "AssetCondition" NOT NULL DEFAULT 'GOOD',
    "status" "AssetStatus" NOT NULL DEFAULT 'AVAILABLE',
    "currentHolderMemberId" TEXT,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostShowNote" (
    "id" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "showDateId" TEXT,
    "note" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostShowNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Production_status_startDate_id_idx" ON "Production"("status", "startDate", "id");

-- CreateIndex
CREATE INDEX "Production_seasonId_status_idx" ON "Production"("seasonId", "status");

-- CreateIndex
CREATE INDEX "Production_createdById_idx" ON "Production"("createdById");

-- CreateIndex
CREATE INDEX "ScriptVersion_productionId_createdAt_idx" ON "ScriptVersion"("productionId", "createdAt");

-- CreateIndex
CREATE INDEX "ScriptVersion_createdById_idx" ON "ScriptVersion"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "ScriptVersion_productionId_version_key" ON "ScriptVersion"("productionId", "version");

-- CreateIndex
CREATE INDEX "ProductionRole_productionId_createdAt_idx" ON "ProductionRole"("productionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionRole_productionId_name_key" ON "ProductionRole"("productionId", "name");

-- CreateIndex
CREATE INDEX "Casting_memberId_roleId_idx" ON "Casting"("memberId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Casting_roleId_memberId_key" ON "Casting"("roleId", "memberId");

-- CreateIndex
CREATE INDEX "CrewAssignment_memberId_productionId_idx" ON "CrewAssignment"("memberId", "productionId");

-- CreateIndex
CREATE INDEX "CrewAssignment_productionId_assignment_idx" ON "CrewAssignment"("productionId", "assignment");

-- CreateIndex
CREATE UNIQUE INDEX "CrewAssignment_productionId_memberId_assignment_key" ON "CrewAssignment"("productionId", "memberId", "assignment");

-- CreateIndex
CREATE INDEX "ProductionTask_productionId_status_deadline_idx" ON "ProductionTask"("productionId", "status", "deadline");

-- CreateIndex
CREATE INDEX "ProductionTask_ownerMemberId_status_deadline_idx" ON "ProductionTask"("ownerMemberId", "status", "deadline");

-- CreateIndex
CREATE INDEX "ProductionTask_createdById_idx" ON "ProductionTask"("createdById");

-- CreateIndex
CREATE INDEX "ShowDate_productionId_startsAt_idx" ON "ShowDate"("productionId", "startsAt");

-- CreateIndex
CREATE INDEX "ShowDate_createdById_idx" ON "ShowDate"("createdById");

-- CreateIndex
CREATE INDEX "CallSheet_showDateId_callAt_idx" ON "CallSheet"("showDateId", "callAt");

-- CreateIndex
CREATE INDEX "CallSheet_createdById_idx" ON "CallSheet"("createdById");

-- CreateIndex
CREATE INDEX "CallSheetMember_memberId_callSheetId_idx" ON "CallSheetMember"("memberId", "callSheetId");

-- CreateIndex
CREATE UNIQUE INDEX "CallSheetMember_callSheetId_memberId_key" ON "CallSheetMember"("callSheetId", "memberId");

-- CreateIndex
CREATE INDEX "Asset_productionId_category_status_idx" ON "Asset"("productionId", "category", "status");

-- CreateIndex
CREATE INDEX "Asset_currentHolderMemberId_status_idx" ON "Asset"("currentHolderMemberId", "status");

-- CreateIndex
CREATE INDEX "Asset_updatedById_idx" ON "Asset"("updatedById");

-- CreateIndex
CREATE INDEX "PostShowNote_productionId_createdAt_idx" ON "PostShowNote"("productionId", "createdAt");

-- CreateIndex
CREATE INDEX "PostShowNote_showDateId_idx" ON "PostShowNote"("showDateId");

-- CreateIndex
CREATE INDEX "PostShowNote_createdById_idx" ON "PostShowNote"("createdById");

-- CreateIndex
CREATE INDEX "Rehearsal_productionId_date_idx" ON "Rehearsal"("productionId", "date");

-- AddForeignKey
ALTER TABLE "Rehearsal" ADD CONSTRAINT "Rehearsal_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Production" ADD CONSTRAINT "Production_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Production" ADD CONSTRAINT "Production_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptVersion" ADD CONSTRAINT "ScriptVersion_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptVersion" ADD CONSTRAINT "ScriptVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionRole" ADD CONSTRAINT "ProductionRole_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Casting" ADD CONSTRAINT "Casting_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "ProductionRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Casting" ADD CONSTRAINT "Casting_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewAssignment" ADD CONSTRAINT "CrewAssignment_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewAssignment" ADD CONSTRAINT "CrewAssignment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTask" ADD CONSTRAINT "ProductionTask_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTask" ADD CONSTRAINT "ProductionTask_ownerMemberId_fkey" FOREIGN KEY ("ownerMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTask" ADD CONSTRAINT "ProductionTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowDate" ADD CONSTRAINT "ShowDate_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowDate" ADD CONSTRAINT "ShowDate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSheet" ADD CONSTRAINT "CallSheet_showDateId_fkey" FOREIGN KEY ("showDateId") REFERENCES "ShowDate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSheet" ADD CONSTRAINT "CallSheet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSheetMember" ADD CONSTRAINT "CallSheetMember_callSheetId_fkey" FOREIGN KEY ("callSheetId") REFERENCES "CallSheet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSheetMember" ADD CONSTRAINT "CallSheetMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_currentHolderMemberId_fkey" FOREIGN KEY ("currentHolderMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostShowNote" ADD CONSTRAINT "PostShowNote_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostShowNote" ADD CONSTRAINT "PostShowNote_showDateId_fkey" FOREIGN KEY ("showDateId") REFERENCES "ShowDate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostShowNote" ADD CONSTRAINT "PostShowNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
