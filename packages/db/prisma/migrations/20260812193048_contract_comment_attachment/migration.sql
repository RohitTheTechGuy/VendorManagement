-- AlterTable
ALTER TABLE "ContractComment" ADD COLUMN     "fileBlobId" TEXT,
ADD COLUMN     "fileName" TEXT;

-- AddForeignKey
ALTER TABLE "ContractComment" ADD CONSTRAINT "ContractComment_fileBlobId_fkey" FOREIGN KEY ("fileBlobId") REFERENCES "FileBlob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

