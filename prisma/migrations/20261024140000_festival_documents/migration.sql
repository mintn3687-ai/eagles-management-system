CREATE TYPE "FestivalDocumentStatus" AS ENUM ('PENDING_UPLOAD', 'READY');

CREATE TABLE "FestivalDocument" (
    "id" TEXT NOT NULL,
    "festivalId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "status" "FestivalDocumentStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "uploadExpiresAt" TIMESTAMP(3) NOT NULL,
    "uploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FestivalDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FestivalDocument_storageKey_key"
    ON "FestivalDocument"("storageKey");
CREATE INDEX "FestivalDocument_festivalId_status_createdAt_idx"
    ON "FestivalDocument"("festivalId", "status", "createdAt");
CREATE INDEX "FestivalDocument_uploadedById_idx"
    ON "FestivalDocument"("uploadedById");
CREATE INDEX "FestivalDocument_status_uploadExpiresAt_idx"
    ON "FestivalDocument"("status", "uploadExpiresAt");
