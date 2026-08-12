-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('BUYER', 'VENDOR');

-- CreateEnum
CREATE TYPE "BuyerRole" AS ENUM ('OWNER', 'QUALITY', 'FINANCE', 'TAX', 'LEGAL');

-- CreateEnum
CREATE TYPE "LinkState" AS ENUM ('INVITED', 'PREQUAL_IN_PROGRESS', 'PREQUAL_SUBMITTED', 'PREQUAL_UNDER_REVIEW', 'PREQUAL_CLEARED', 'AWARDED', 'FULL_IN_PROGRESS', 'FULL_SUBMITTED', 'FULL_UNDER_REVIEW', 'CONTRACTS_IN_PROGRESS', 'APPROVED', 'ERP_SYNCING', 'ONBOARDED', 'REJECTED', 'ON_HOLD', 'WITHDRAWN', 'ERP_FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LinkStage" AS ENUM ('PREQUAL', 'FULL');

-- CreateEnum
CREATE TYPE "ActorSide" AS ENUM ('VENDOR', 'BUYER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PartySide" AS ENUM ('VENDOR', 'BUYER');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VerificationCheckType" AS ENUM ('PAN', 'GST', 'UDYAM', 'PENNY_DROP', 'GST_FILINGS');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('RUNNING', 'PASSED', 'FAILED', 'NEEDS_REVIEW', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReviewTaskStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "ApprovalDecisionType" AS ENUM ('APPROVED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('NDA', 'MSA', 'QUALITY_AGREEMENT', 'SUPPLY_AGREEMENT', 'PRICING_AGREEMENT', 'DATA_PROCESSING');

-- CreateEnum
CREATE TYPE "ContractState" AS ENUM ('DRAFT_PENDING', 'DRAFT_UPLOADED', 'VENDOR_REVIEW', 'CHANGES_REQUESTED', 'REVISED', 'AGREED', 'AWAITING_SIGNATURES', 'PARTIALLY_EXECUTED', 'EXECUTED');

-- CreateEnum
CREATE TYPE "ContractVersionKind" AS ENUM ('DRAFT', 'REVISED', 'VENDOR_SIGNED', 'BUYER_SIGNED');

-- ---------------------------------------------------------------------------
-- Rename BuyerUser -> AppUser IN PLACE so existing buyer rows are preserved
-- (Prisma's diff wanted DROP+CREATE; we keep the data instead).
-- ---------------------------------------------------------------------------
ALTER TABLE "BuyerUser" RENAME TO "AppUser";
ALTER TABLE "AppUser" RENAME CONSTRAINT "BuyerUser_pkey" TO "AppUser_pkey";
ALTER INDEX "BuyerUser_email_key" RENAME TO "AppUser_email_key";
ALTER INDEX "BuyerUser_orgId_idx" RENAME TO "AppUser_orgId_idx";

-- orgId + passwordHash become nullable (a vendor has no org and no password yet).
ALTER TABLE "AppUser" ALTER COLUMN "orgId" DROP NOT NULL;
ALTER TABLE "AppUser" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- role: TEXT DEFAULT 'buyer'  ->  "BuyerRole" (nullable). Existing buyers were the
-- requirement owner, so map any legacy value to OWNER before the type change.
ALTER TABLE "AppUser" ALTER COLUMN "role" DROP DEFAULT;
UPDATE "AppUser" SET "role" = 'OWNER' WHERE "role" NOT IN ('OWNER', 'QUALITY', 'FINANCE', 'TAX', 'LEGAL');
ALTER TABLE "AppUser" ALTER COLUMN "role" TYPE "BuyerRole" USING "role"::"BuyerRole";
ALTER TABLE "AppUser" ALTER COLUMN "role" DROP NOT NULL;

-- New columns. All existing rows are buyers, so backfill userType = 'BUYER'
-- with a temporary default, then drop the default to match the schema.
ALTER TABLE "AppUser" ADD COLUMN "userType" "UserType" NOT NULL DEFAULT 'BUYER';
ALTER TABLE "AppUser" ALTER COLUMN "userType" DROP DEFAULT;
ALTER TABLE "AppUser" ADD COLUMN "vendorEntityId" TEXT;

-- orgId FK action changes RESTRICT -> SET NULL now that the relation is optional.
ALTER TABLE "AppUser" DROP CONSTRAINT "BuyerUser_orgId_fkey";
ALTER TABLE "AppUser" ADD CONSTRAINT "AppUser_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "BuyerOrg"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- NOTE: "Requirement_ownerUserId_fkey" already points at the renamed table
-- (now AppUser) with the same ON DELETE RESTRICT / ON UPDATE CASCADE action,
-- so it is intentionally left untouched — no drop/recreate needed.

-- CreateTable
CREATE TABLE "VendorBuyerLink" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "vendorUserId" TEXT,
    "state" "LinkState" NOT NULL DEFAULT 'INVITED',
    "stage" "LinkStage",
    "prequalScore" INTEGER,
    "awardedAt" TIMESTAMP(3),
    "onboardedAt" TIMESTAMP(3),
    "erpVendorCode" TEXT,
    "currentStateSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorBuyerLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkEvent" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "fromState" "LinkState",
    "toState" "LinkState" NOT NULL,
    "actorType" "ActorSide" NOT NULL,
    "actorId" TEXT,
    "side" "ActorSide" NOT NULL,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "stage" "LinkStage" NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "submittedAt" TIMESTAMP(3),
    "resolvedChecklist" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldValue" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "value" TEXT,
    "source" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT,
    "linkId" TEXT NOT NULL,
    "checklistItemKey" TEXT NOT NULL,
    "fileBlobId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesDocumentId" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationCheck" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "checkType" "VerificationCheckType" NOT NULL,
    "subjectValue" TEXT,
    "status" "VerificationStatus" NOT NULL DEFAULT 'RUNNING',
    "matchScore" INTEGER,
    "detail" JSONB,
    "ranAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewTask" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "role" "BuyerRole" NOT NULL,
    "assignedUserId" TEXT,
    "status" "ReviewTaskStatus" NOT NULL DEFAULT 'PENDING',
    "slaHours" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalDecision" (
    "id" TEXT NOT NULL,
    "reviewTaskId" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "decision" "ApprovalDecisionType" NOT NULL,
    "comment" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "contractType" "ContractType" NOT NULL,
    "state" "ContractState" NOT NULL DEFAULT 'DRAFT_PENDING',
    "currentVersionId" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractVersion" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "fileBlobId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "uploadedBySide" "PartySide" NOT NULL,
    "kind" "ContractVersionKind" NOT NULL,
    "supersedesVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractComment" (
    "id" TEXT NOT NULL,
    "contractVersionId" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "authorSide" "PartySide" NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileBlob" (
    "id" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "sha256" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileBlob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VendorBuyerLink_candidateId_key" ON "VendorBuyerLink"("candidateId");

-- CreateIndex
CREATE INDEX "VendorBuyerLink_requirementId_idx" ON "VendorBuyerLink"("requirementId");

-- CreateIndex
CREATE INDEX "VendorBuyerLink_orgId_idx" ON "VendorBuyerLink"("orgId");

-- CreateIndex
CREATE INDEX "VendorBuyerLink_vendorUserId_idx" ON "VendorBuyerLink"("vendorUserId");

-- CreateIndex
CREATE INDEX "LinkEvent_linkId_idx" ON "LinkEvent"("linkId");

-- CreateIndex
CREATE INDEX "Submission_linkId_idx" ON "Submission"("linkId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_linkId_stage_key" ON "Submission"("linkId", "stage");

-- CreateIndex
CREATE INDEX "FieldValue_linkId_idx" ON "FieldValue"("linkId");

-- CreateIndex
CREATE INDEX "FieldValue_submissionId_idx" ON "FieldValue"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "FieldValue_submissionId_fieldKey_key" ON "FieldValue"("submissionId", "fieldKey");

-- CreateIndex
CREATE INDEX "Document_linkId_idx" ON "Document"("linkId");

-- CreateIndex
CREATE INDEX "Document_submissionId_idx" ON "Document"("submissionId");

-- CreateIndex
CREATE INDEX "VerificationCheck_linkId_idx" ON "VerificationCheck"("linkId");

-- CreateIndex
CREATE INDEX "ReviewTask_linkId_idx" ON "ReviewTask"("linkId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewTask_linkId_role_key" ON "ReviewTask"("linkId", "role");

-- CreateIndex
CREATE INDEX "ApprovalDecision_linkId_idx" ON "ApprovalDecision"("linkId");

-- CreateIndex
CREATE INDEX "ApprovalDecision_reviewTaskId_idx" ON "ApprovalDecision"("reviewTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_currentVersionId_key" ON "Contract"("currentVersionId");

-- CreateIndex
CREATE INDEX "Contract_linkId_idx" ON "Contract"("linkId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_linkId_contractType_key" ON "Contract"("linkId", "contractType");

-- CreateIndex
CREATE INDEX "ContractVersion_contractId_idx" ON "ContractVersion"("contractId");

-- CreateIndex
CREATE INDEX "ContractVersion_linkId_idx" ON "ContractVersion"("linkId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractVersion_contractId_versionNo_key" ON "ContractVersion"("contractId", "versionNo");

-- CreateIndex
CREATE INDEX "ContractComment_linkId_idx" ON "ContractComment"("linkId");

-- CreateIndex
CREATE INDEX "ContractComment_contractVersionId_idx" ON "ContractComment"("contractVersionId");

-- AddForeignKey
-- (AppUser_orgId_fkey and Requirement_ownerUserId_fkey are handled in the
-- rename block above and intentionally not re-created here.)
ALTER TABLE "VendorBuyerLink" ADD CONSTRAINT "VendorBuyerLink_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBuyerLink" ADD CONSTRAINT "VendorBuyerLink_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBuyerLink" ADD CONSTRAINT "VendorBuyerLink_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "BuyerOrg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBuyerLink" ADD CONSTRAINT "VendorBuyerLink_vendorUserId_fkey" FOREIGN KEY ("vendorUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkEvent" ADD CONSTRAINT "LinkEvent_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "VendorBuyerLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "VendorBuyerLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldValue" ADD CONSTRAINT "FieldValue_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldValue" ADD CONSTRAINT "FieldValue_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "VendorBuyerLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "VendorBuyerLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_fileBlobId_fkey" FOREIGN KEY ("fileBlobId") REFERENCES "FileBlob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_supersedesDocumentId_fkey" FOREIGN KEY ("supersedesDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationCheck" ADD CONSTRAINT "VerificationCheck_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "VendorBuyerLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewTask" ADD CONSTRAINT "ReviewTask_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "VendorBuyerLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewTask" ADD CONSTRAINT "ReviewTask_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_reviewTaskId_fkey" FOREIGN KEY ("reviewTaskId") REFERENCES "ReviewTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "VendorBuyerLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "VendorBuyerLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "ContractVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractVersion" ADD CONSTRAINT "ContractVersion_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractVersion" ADD CONSTRAINT "ContractVersion_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "VendorBuyerLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractVersion" ADD CONSTRAINT "ContractVersion_fileBlobId_fkey" FOREIGN KEY ("fileBlobId") REFERENCES "FileBlob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractVersion" ADD CONSTRAINT "ContractVersion_supersedesVersionId_fkey" FOREIGN KEY ("supersedesVersionId") REFERENCES "ContractVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractComment" ADD CONSTRAINT "ContractComment_contractVersionId_fkey" FOREIGN KEY ("contractVersionId") REFERENCES "ContractVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractComment" ADD CONSTRAINT "ContractComment_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "VendorBuyerLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

