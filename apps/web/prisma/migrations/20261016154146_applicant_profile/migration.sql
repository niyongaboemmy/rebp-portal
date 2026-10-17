-- UX-010: applicant profile — Section B answers kept on the account and reused by every
-- application. Additive and nullable. (Prisma also proposed dropping the trigram index on
-- RegisterEntry.searchText; that index is defined in raw SQL in an earlier migration, so it stays.)

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "profile" JSONB,
ADD COLUMN     "profileUpdatedAt" TIMESTAMP(3);
