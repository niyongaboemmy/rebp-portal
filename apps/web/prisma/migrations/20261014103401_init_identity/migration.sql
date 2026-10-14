-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('INDIVIDUAL', 'ORGANISATION');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('APPLICANT', 'SUPERVISOR', 'PRINCIPAL_BROKER', 'FIRM_ADMIN', 'REVIEWING_OFFICER', 'APPROVING_AUTHORITY', 'REGISTRAR', 'FINANCE_OFFICER', 'SYSTEM_ADMIN', 'AUDITOR');

-- CreateEnum
CREATE TYPE "MfaMethod" AS ENUM ('TOTP', 'SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "VerificationPurpose" AS ENUM ('EMAIL_VERIFY', 'PHONE_VERIFY', 'PASSWORD_RESET', 'MFA_LOGIN', 'MFA_ENROL');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "phone" TEXT,
    "phoneVerifiedAt" TIMESTAMP(3),
    "passwordHash" TEXT,
    "passwordChangedAt" TIMESTAMP(3),
    "accountType" "AccountType" NOT NULL DEFAULT 'INDIVIDUAL',
    "fullName" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "roles" "Role"[] DEFAULT ARRAY['APPLICANT']::"Role"[],
    "mfaPreferred" "MfaMethod",
    "mfaMethods" "MfaMethod"[] DEFAULT ARRAY[]::"MfaMethod"[],
    "totpSecretEnc" TEXT,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastSignInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authenticatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "method" TEXT NOT NULL,
    "mfaVerified" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthAccount" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "email" TEXT,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryCode" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationCode" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "purpose" "VerificationPurpose" NOT NULL,
    "target" TEXT NOT NULL,
    "context" TEXT,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginChallenge" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "method" TEXT NOT NULL,
    "activeMfa" "MfaMethod" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "recipient" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" BIGSERIAL NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "prevHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_provider_providerAccountId_key" ON "OAuthAccount"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_userId_provider_key" ON "OAuthAccount"("userId", "provider");

-- CreateIndex
CREATE INDEX "RecoveryCode_userId_idx" ON "RecoveryCode"("userId");

-- CreateIndex
CREATE INDEX "VerificationCode_userId_purpose_idx" ON "VerificationCode"("userId", "purpose");

-- CreateIndex
CREATE INDEX "VerificationCode_target_purpose_idx" ON "VerificationCode"("target", "purpose");

-- CreateIndex
CREATE INDEX "LoginChallenge_userId_idx" ON "LoginChallenge"("userId");

-- CreateIndex
CREATE INDEX "NotificationLog_recipient_createdAt_idx" ON "NotificationLog"("recipient", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_hash_key" ON "AuditEvent"("hash");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_actorId_idx" ON "AuditEvent"("actorId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAccount" ADD CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryCode" ADD CONSTRAINT "RecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationCode" ADD CONSTRAINT "VerificationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginChallenge" ADD CONSTRAINT "LoginChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
