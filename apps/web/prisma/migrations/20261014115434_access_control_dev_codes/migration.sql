-- AlterTable
ALTER TABLE "NotificationLog" ADD COLUMN     "devCode" TEXT;

-- CreateTable
CREATE TABLE "RolePermission" (
    "role" "Role" NOT NULL,
    "capability" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "updatedById" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("role","capability")
);
