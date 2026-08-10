-- CreateEnum
CREATE TYPE "RequirementStage" AS ENUM ('DRAFT', 'CANDIDATES_SELECTED', 'INVITES_SENT', 'IN_PROGRESS', 'CLOSED');

-- CreateEnum
CREATE TYPE "CandidateSource" AS ENUM ('MANUAL', 'DIRECTORY');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('NOT_INVITED', 'INVITED', 'OPENED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('SENT', 'OPENED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BadgeState" AS ENUM ('VERIFIED', 'LISTED', 'STALE');

-- CreateTable
CREATE TABLE "BuyerOrg" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuyerOrg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerUser" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT,
    "role" TEXT NOT NULL DEFAULT 'buyer',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuyerUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requirement" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "partCategory" TEXT,
    "processCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "plantLocation" TEXT,
    "targetAwardDate" TIMESTAMP(3),
    "stage" "RequirementStage" NOT NULL DEFAULT 'DRAFT',
    "ownerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectoryVendor" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "pan" TEXT,
    "primaryGstin" TEXT,
    "contactEmail" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "processTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "certificationTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "badgeState" "BadgeState" NOT NULL DEFAULT 'VERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectoryVendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "source" "CandidateSource" NOT NULL,
    "directoryVendorId" TEXT,
    "legalName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "pan" TEXT,
    "gstin" TEXT,
    "city" TEXT,
    "state" TEXT,
    "inviteStatus" "InviteStatus" NOT NULL DEFAULT 'NOT_INVITED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "magicTokenPlain" TEXT,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "openedAt" TIMESTAMP(3),
    "resendCount" INTEGER NOT NULL DEFAULT 0,
    "status" "InvitationStatus" NOT NULL DEFAULT 'SENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BuyerUser_email_key" ON "BuyerUser"("email");

-- CreateIndex
CREATE INDEX "BuyerUser_orgId_idx" ON "BuyerUser"("orgId");

-- CreateIndex
CREATE INDEX "Requirement_orgId_idx" ON "Requirement"("orgId");

-- CreateIndex
CREATE INDEX "Candidate_requirementId_idx" ON "Candidate"("requirementId");

-- CreateIndex
CREATE INDEX "Candidate_orgId_idx" ON "Candidate"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_candidateId_key" ON "Invitation"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_orgId_idx" ON "Invitation"("orgId");

-- AddForeignKey
ALTER TABLE "BuyerUser" ADD CONSTRAINT "BuyerUser_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "BuyerOrg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "BuyerOrg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "BuyerUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "BuyerOrg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_directoryVendorId_fkey" FOREIGN KEY ("directoryVendorId") REFERENCES "DirectoryVendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "BuyerOrg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
