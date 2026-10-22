CREATE TYPE "ElectionStatus" AS ENUM ('DRAFT', 'NOMINATIONS_OPEN', 'VOTING_OPEN', 'CLOSED', 'RESULTS_PUBLISHED');
CREATE TYPE "NominationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "ElectionTieRule" AS ENUM ('CO_WINNERS', 'NO_WINNER');
CREATE TYPE "BallotChoiceType" AS ENUM ('CANDIDATE', 'ABSTAIN', 'NONE_OF_ABOVE');

CREATE TABLE "Election" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "ElectionStatus" NOT NULL DEFAULT 'DRAFT',
  "requireActiveMember" BOOLEAN NOT NULL DEFAULT true,
  "requireFeesCurrent" BOOLEAN NOT NULL DEFAULT false,
  "eligibleVoterCount" INTEGER NOT NULL DEFAULT 0,
  "eligibilitySnapshotHash" TEXT,
  "nominationsOpenedAt" TIMESTAMP(3),
  "votingOpenedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "resultsPublishedAt" TIMESTAMP(3),
  "resultsApprovedById" TEXT,
  "resultsApprovedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Election_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Election_eligibleVoterCount_check" CHECK ("eligibleVoterCount" >= 0),
  CONSTRAINT "Election_lifecycle_timestamps_check" CHECK (
    ("status" = 'DRAFT' AND "nominationsOpenedAt" IS NULL AND "votingOpenedAt" IS NULL AND "closedAt" IS NULL AND "resultsPublishedAt" IS NULL AND "resultsApprovedById" IS NULL AND "resultsApprovedAt" IS NULL)
    OR ("status" = 'NOMINATIONS_OPEN' AND "nominationsOpenedAt" IS NOT NULL AND "votingOpenedAt" IS NULL AND "closedAt" IS NULL AND "resultsPublishedAt" IS NULL AND "resultsApprovedById" IS NULL AND "resultsApprovedAt" IS NULL)
    OR ("status" = 'VOTING_OPEN' AND "nominationsOpenedAt" IS NOT NULL AND "votingOpenedAt" IS NOT NULL AND "closedAt" IS NULL AND "resultsPublishedAt" IS NULL AND "resultsApprovedById" IS NULL AND "resultsApprovedAt" IS NULL)
    OR ("status" = 'CLOSED' AND "nominationsOpenedAt" IS NOT NULL AND "votingOpenedAt" IS NOT NULL AND "closedAt" IS NOT NULL AND "resultsPublishedAt" IS NULL AND (("resultsApprovedById" IS NULL AND "resultsApprovedAt" IS NULL) OR ("resultsApprovedById" IS NOT NULL AND "resultsApprovedAt" IS NOT NULL)))
    OR ("status" = 'RESULTS_PUBLISHED' AND "nominationsOpenedAt" IS NOT NULL AND "votingOpenedAt" IS NOT NULL AND "closedAt" IS NOT NULL AND "resultsPublishedAt" IS NOT NULL AND "resultsApprovedById" IS NOT NULL AND "resultsApprovedAt" IS NOT NULL)
  ),
  CONSTRAINT "Election_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Election_resultsApprovedById_fkey" FOREIGN KEY ("resultsApprovedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Election_status_createdAt_id_idx" ON "Election"("status", "createdAt" DESC, "id");
CREATE INDEX "Election_createdById_idx" ON "Election"("createdById");
CREATE INDEX "Election_resultsApprovedById_idx" ON "Election"("resultsApprovedById");

CREATE TABLE "Office" (
  "id" TEXT NOT NULL,
  "electionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "tieRule" "ElectionTieRule" NOT NULL DEFAULT 'NO_WINNER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Office_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Office_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Office_electionId_title_key" ON "Office"("electionId", "title");
CREATE INDEX "Office_electionId_sortOrder_id_idx" ON "Office"("electionId", "sortOrder", "id");

CREATE TABLE "Nomination" (
  "id" TEXT NOT NULL,
  "electionId" TEXT NOT NULL,
  "officeId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "status" "NominationStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Nomination_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Nomination_review_check" CHECK (
    ("status" = 'PENDING' AND "reviewedById" IS NULL AND "reviewedAt" IS NULL)
    OR ("status" <> 'PENDING' AND "reviewedById" IS NOT NULL AND "reviewedAt" IS NOT NULL)
  ),
  CONSTRAINT "Nomination_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Nomination_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Nomination_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Nomination_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Nomination_officeId_memberId_key" ON "Nomination"("officeId", "memberId");
CREATE INDEX "Nomination_electionId_status_createdAt_idx" ON "Nomination"("electionId", "status", "createdAt");
CREATE INDEX "Nomination_memberId_electionId_idx" ON "Nomination"("memberId", "electionId");
CREATE INDEX "Nomination_reviewedById_idx" ON "Nomination"("reviewedById");

CREATE TABLE "EligibleVoter" (
  "id" TEXT NOT NULL,
  "electionId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "frozenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EligibleVoter_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EligibleVoter_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EligibleVoter_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EligibleVoter_electionId_memberId_key" ON "EligibleVoter"("electionId", "memberId");
CREATE INDEX "EligibleVoter_memberId_electionId_idx" ON "EligibleVoter"("memberId", "electionId");

CREATE TABLE "Ballot" (
  "id" TEXT NOT NULL,
  "electionId" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Ballot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Ballot_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Ballot_electionId_submittedAt_idx" ON "Ballot"("electionId", "submittedAt");

CREATE TABLE "BallotChoice" (
  "id" TEXT NOT NULL,
  "ballotId" TEXT NOT NULL,
  "officeId" TEXT NOT NULL,
  "choiceType" "BallotChoiceType" NOT NULL,
  "nominationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BallotChoice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BallotChoice_candidate_check" CHECK (
    ("choiceType" = 'CANDIDATE' AND "nominationId" IS NOT NULL)
    OR ("choiceType" <> 'CANDIDATE' AND "nominationId" IS NULL)
  ),
  CONSTRAINT "BallotChoice_ballotId_fkey" FOREIGN KEY ("ballotId") REFERENCES "Ballot"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BallotChoice_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BallotChoice_nominationId_fkey" FOREIGN KEY ("nominationId") REFERENCES "Nomination"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BallotChoice_ballotId_officeId_key" ON "BallotChoice"("ballotId", "officeId");
CREATE INDEX "BallotChoice_officeId_choiceType_nominationId_idx" ON "BallotChoice"("officeId", "choiceType", "nominationId");

CREATE TABLE "VoteReceipt" (
  "id" TEXT NOT NULL,
  "electionId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "officeId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VoteReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VoteReceipt_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "VoteReceipt_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "VoteReceipt_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "VoteReceipt_electionId_memberId_officeId_key" ON "VoteReceipt"("electionId", "memberId", "officeId");
CREATE INDEX "VoteReceipt_electionId_memberId_idx" ON "VoteReceipt"("electionId", "memberId");
CREATE INDEX "VoteReceipt_officeId_memberId_idx" ON "VoteReceipt"("officeId", "memberId");
