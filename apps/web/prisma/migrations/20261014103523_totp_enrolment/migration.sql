-- AlterTable
ALTER TABLE "User" ADD COLUMN     "totpLastCounter" INTEGER,
ADD COLUMN     "totpPendingSecretEnc" TEXT;
