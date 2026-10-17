-- UX-010: identity documents on the applicant profile, copied into applications.
-- (Prisma also proposed dropping the raw-SQL trigram index on RegisterEntry.searchText; kept.)

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "fromProfile" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ProfileDocument" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL,
    "scanDetail" TEXT,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfileDocument_storageKey_key" ON "ProfileDocument"("storageKey");

-- CreateIndex
CREATE INDEX "ProfileDocument_userId_type_idx" ON "ProfileDocument"("userId", "type");

-- AddForeignKey
ALTER TABLE "ProfileDocument" ADD CONSTRAINT "ProfileDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
