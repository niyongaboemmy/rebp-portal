-- CreateEnum
CREATE TYPE "ApplicationType" AS ENUM ('NEW', 'UPGRADE', 'RENEWAL', 'CHANGE_OF_AFFILIATION', 'REINSTATEMENT', 'FIRM_REGISTRATION');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('RERA', 'FSLA', 'REA', 'BROKER', 'ASSOCIATE_BROKER', 'MANAGING_BROKER', 'PRINCIPAL_BROKER', 'REBF');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'PENDING_CONFIRMATIONS', 'SUBMITTED', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'FURTHER_ASSESSMENT', 'PENDING_DECISION', 'APPROVED', 'APPROVED_WITH_CONDITIONS', 'DEFERRED', 'REJECTED', 'LICENSE_ISSUED', 'WITHDRAWN', 'EXPIRED_DRAFT');

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'LAPSED', 'SUSPENDED', 'REVOKED', 'SURRENDERED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ConfirmationKind" AS ENUM ('SUPERVISOR', 'PRINCIPAL_BROKER', 'DESIGNATION');

-- CreateEnum
CREATE TYPE "ConfirmationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('SCANNING', 'CLEAN', 'INFECTED', 'REJECTED_FILE', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED', 'WAIVED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MOBILE_MONEY', 'CARD', 'BANK', 'WAIVER');

-- CreateEnum
CREATE TYPE "RegistrantKind" AS ENUM ('PERSON', 'FIRM');

-- CreateEnum
CREATE TYPE "ConfigStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUPERSEDED', 'REJECTED');

-- AlterEnum
ALTER TYPE "VerificationPurpose" ADD VALUE 'SIGNATURE';

-- CreateTable
CREATE TABLE "Application" (
    "id" UUID NOT NULL,
    "referenceNo" TEXT NOT NULL,
    "type" "ApplicationType" NOT NULL,
    "category" "Category" NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "applicantId" UUID NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "relatedLicenceId" UUID,
    "linkedApplicationId" UUID,
    "unlockedSections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "unlockedDocuments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "extraDocuments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastStep" TEXT,
    "assignedOfficerId" UUID,
    "assignedAt" TIMESTAMP(3),
    "slaDueAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "lateRenewal" BOOLEAN NOT NULL DEFAULT false,
    "eligibilityOutcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationEvent" (
    "id" BIGSERIAL NOT NULL,
    "applicationId" UUID NOT NULL,
    "fromStatus" "ApplicationStatus",
    "toStatus" "ApplicationStatus" NOT NULL,
    "actorId" UUID,
    "reason" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationSnapshot" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "checklist" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "signature" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EligibilityRun" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "context" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "thresholdsVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EligibilityRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "ownerId" UUID NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "DocumentStatus" NOT NULL DEFAULT 'SCANNING',
    "officerNote" TEXT,
    "verifiedById" UUID,
    "verifiedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "scanStatus" "DocumentStatus" NOT NULL,
    "scanDetail" TEXT,
    "uploadedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfirmationRequest" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "kind" "ConfirmationKind" NOT NULL,
    "addresseeId" UUID NOT NULL,
    "licenceId" UUID,
    "firmId" UUID,
    "status" "ConfirmationStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "overriddenById" UUID,
    "overrideReason" TEXT,
    "reminders" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfirmationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "lines" JSONB NOT NULL,
    "feeVersion" INTEGER NOT NULL,
    "method" "PaymentMethod",
    "msisdn" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "providerTxnId" TEXT,
    "receiptNo" TEXT,
    "payerId" UUID NOT NULL,
    "paidAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "waivedById" UUID,
    "waiverReason" TEXT,
    "duplicate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" UUID NOT NULL,
    "eventId" TEXT NOT NULL,
    "paymentId" UUID,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "officerId" UUID NOT NULL,
    "checks" JSONB NOT NULL DEFAULT '{}',
    "documentation" TEXT,
    "documentationOverrideReason" TEXT,
    "eligibility" TEXT,
    "eligibilityOverrideReason" TEXT,
    "computed" JSONB NOT NULL DEFAULT '{}',
    "internalComment" TEXT,
    "applicantComment" TEXT,
    "recommendation" TEXT,
    "reasonCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reasons" TEXT,
    "legalReference" TEXT,
    "signedAt" TIMESTAMP(3),
    "signature" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InformationRequest" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "officerId" UUID NOT NULL,
    "template" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "documents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "extraDocument" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InformationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "approverId" UUID NOT NULL,
    "decision" TEXT NOT NULL,
    "approvedCategory" "Category",
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "geoScope" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reasons" TEXT,
    "reasonCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "letterNo" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL,
    "signature" JSONB NOT NULL,
    "correctsId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registrant" (
    "id" UUID NOT NULL,
    "kind" "RegistrantKind" NOT NULL,
    "registrationNo" TEXT NOT NULL,
    "userId" UUID,
    "firmId" UUID,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Registrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Firm" (
    "id" UUID NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradingName" TEXT,
    "companyRegNo" TEXT NOT NULL,
    "ownerId" UUID,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "address" JSONB NOT NULL DEFAULT '{}',
    "district" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "principalLicenceId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Firm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" UUID NOT NULL,
    "firmId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" JSONB NOT NULL DEFAULT '{}',
    "district" TEXT,
    "phone" TEXT,
    "managingLicenceId" UUID,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Licence" (
    "id" UUID NOT NULL,
    "licenceNo" TEXT NOT NULL,
    "registrantId" UUID NOT NULL,
    "holderId" UUID,
    "firmId" UUID,
    "category" "Category" NOT NULL,
    "status" "LicenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "displayName" TEXT NOT NULL,
    "issuedAt" DATE NOT NULL,
    "expiresAt" DATE NOT NULL,
    "applicationId" UUID,
    "decisionId" UUID,
    "scope" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "practiceArrangement" TEXT,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "supervisorLicenceId" UUID,
    "affiliatedFirmId" UUID,
    "branchId" UUID,
    "qrToken" TEXT NOT NULL,
    "certificateVersion" INTEGER NOT NULL DEFAULT 1,
    "supersededById" UUID,
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "photoVersionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Licence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenceEvent" (
    "id" BIGSERIAL NOT NULL,
    "licenceId" UUID NOT NULL,
    "fromStatus" "LicenseStatus",
    "toStatus" "LicenseStatus" NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "reference" TEXT,
    "startsOn" DATE,
    "endsOn" DATE,
    "actorId" UUID,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicenceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Affiliation" (
    "id" UUID NOT NULL,
    "licenceId" UUID NOT NULL,
    "firmId" UUID NOT NULL,
    "supervisorLicenceId" UUID,
    "branchId" UUID,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE,
    "endReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Affiliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegisterEntry" (
    "licenceId" UUID NOT NULL,
    "registrationNo" TEXT NOT NULL,
    "licenceNo" TEXT NOT NULL,
    "kind" "RegistrantKind" NOT NULL,
    "displayName" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "status" "LicenseStatus" NOT NULL,
    "issuedAt" DATE NOT NULL,
    "expiresAt" DATE NOT NULL,
    "firmName" TEXT,
    "branchName" TEXT,
    "district" TEXT,
    "province" TEXT,
    "scope" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "conditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "principalName" TEXT,
    "qrToken" TEXT NOT NULL,
    "searchText" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegisterEntry_pkey" PRIMARY KEY ("licenceId")
);

-- CreateTable
CREATE TABLE "RegisterAction" (
    "id" UUID NOT NULL,
    "licenceId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "reason" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "makerId" UUID NOT NULL,
    "checkerId" UUID,
    "note" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegisterAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "messageKey" TEXT NOT NULL,
    "values" JSONB NOT NULL DEFAULT '{}',
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderLog" (
    "key" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderLog_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ConfigVersion" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "value" JSONB NOT NULL,
    "status" "ConfigStatus" NOT NULL DEFAULT 'PENDING',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "makerId" UUID NOT NULL,
    "checkerId" UUID,
    "note" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfigVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminDivision" (
    "code" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "parentCode" TEXT,

    CONSTRAINT "AdminDivision_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "ConflictDeclaration" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "officerId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConflictDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Application_referenceNo_key" ON "Application"("referenceNo");

-- CreateIndex
CREATE INDEX "Application_applicantId_idx" ON "Application"("applicantId");

-- CreateIndex
CREATE INDEX "Application_status_idx" ON "Application"("status");

-- CreateIndex
CREATE INDEX "Application_assignedOfficerId_idx" ON "Application"("assignedOfficerId");

-- CreateIndex
CREATE INDEX "ApplicationEvent_applicationId_idx" ON "ApplicationEvent"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationSnapshot_applicationId_version_key" ON "ApplicationSnapshot"("applicationId", "version");

-- CreateIndex
CREATE INDEX "EligibilityRun_applicationId_createdAt_idx" ON "EligibilityRun"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "Document_applicationId_type_idx" ON "Document"("applicationId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_storageKey_key" ON "DocumentVersion"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_documentId_version_key" ON "DocumentVersion"("documentId", "version");

-- CreateIndex
CREATE INDEX "ConfirmationRequest_addresseeId_status_idx" ON "ConfirmationRequest"("addresseeId", "status");

-- CreateIndex
CREATE INDEX "ConfirmationRequest_applicationId_idx" ON "ConfirmationRequest"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerTxnId_key" ON "Payment"("providerTxnId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptNo_key" ON "Payment"("receiptNo");

-- CreateIndex
CREATE INDEX "Payment_applicationId_idx" ON "Payment"("applicationId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_eventId_key" ON "PaymentEvent"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_applicationId_version_key" ON "Review"("applicationId", "version");

-- CreateIndex
CREATE INDEX "InformationRequest_applicationId_idx" ON "InformationRequest"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Decision_letterNo_key" ON "Decision"("letterNo");

-- CreateIndex
CREATE INDEX "Decision_applicationId_idx" ON "Decision"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Registrant_registrationNo_key" ON "Registrant"("registrationNo");

-- CreateIndex
CREATE UNIQUE INDEX "Registrant_userId_key" ON "Registrant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Registrant_firmId_key" ON "Registrant"("firmId");

-- CreateIndex
CREATE UNIQUE INDEX "Firm_companyRegNo_key" ON "Firm"("companyRegNo");

-- CreateIndex
CREATE UNIQUE INDEX "Licence_licenceNo_key" ON "Licence"("licenceNo");

-- CreateIndex
CREATE UNIQUE INDEX "Licence_qrToken_key" ON "Licence"("qrToken");

-- CreateIndex
CREATE INDEX "Licence_category_status_idx" ON "Licence"("category", "status");

-- CreateIndex
CREATE INDEX "Licence_holderId_idx" ON "Licence"("holderId");

-- CreateIndex
CREATE INDEX "Licence_supervisorLicenceId_idx" ON "Licence"("supervisorLicenceId");

-- CreateIndex
CREATE INDEX "Licence_affiliatedFirmId_idx" ON "Licence"("affiliatedFirmId");

-- CreateIndex
CREATE INDEX "LicenceEvent_licenceId_idx" ON "LicenceEvent"("licenceId");

-- CreateIndex
CREATE INDEX "Affiliation_firmId_idx" ON "Affiliation"("firmId");

-- CreateIndex
CREATE INDEX "Affiliation_licenceId_idx" ON "Affiliation"("licenceId");

-- CreateIndex
CREATE UNIQUE INDEX "RegisterEntry_licenceNo_key" ON "RegisterEntry"("licenceNo");

-- CreateIndex
CREATE UNIQUE INDEX "RegisterEntry_qrToken_key" ON "RegisterEntry"("qrToken");

-- CreateIndex
CREATE INDEX "RegisterEntry_category_status_idx" ON "RegisterEntry"("category", "status");

-- CreateIndex
CREATE INDEX "RegisterEntry_district_idx" ON "RegisterEntry"("district");

-- CreateIndex
CREATE INDEX "RegisterAction_status_idx" ON "RegisterAction"("status");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "ConfigVersion_key_status_idx" ON "ConfigVersion"("key", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigVersion_key_version_key" ON "ConfigVersion"("key", "version");

-- CreateIndex
CREATE INDEX "AdminDivision_parentCode_idx" ON "AdminDivision"("parentCode");

-- CreateIndex
CREATE UNIQUE INDEX "ConflictDeclaration_applicationId_officerId_key" ON "ConflictDeclaration"("applicationId", "officerId");

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_relatedLicenceId_fkey" FOREIGN KEY ("relatedLicenceId") REFERENCES "Licence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_assignedOfficerId_fkey" FOREIGN KEY ("assignedOfficerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEvent" ADD CONSTRAINT "ApplicationEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationSnapshot" ADD CONSTRAINT "ApplicationSnapshot_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityRun" ADD CONSTRAINT "EligibilityRun_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfirmationRequest" ADD CONSTRAINT "ConfirmationRequest_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfirmationRequest" ADD CONSTRAINT "ConfirmationRequest_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InformationRequest" ADD CONSTRAINT "InformationRequest_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registrant" ADD CONSTRAINT "Registrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registrant" ADD CONSTRAINT "Registrant_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Firm" ADD CONSTRAINT "Firm_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Licence" ADD CONSTRAINT "Licence_registrantId_fkey" FOREIGN KEY ("registrantId") REFERENCES "Registrant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Licence" ADD CONSTRAINT "Licence_holderId_fkey" FOREIGN KEY ("holderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Licence" ADD CONSTRAINT "Licence_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Licence" ADD CONSTRAINT "Licence_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Licence" ADD CONSTRAINT "Licence_affiliatedFirmId_fkey" FOREIGN KEY ("affiliatedFirmId") REFERENCES "Firm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Licence" ADD CONSTRAINT "Licence_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenceEvent" ADD CONSTRAINT "LicenceEvent_licenceId_fkey" FOREIGN KEY ("licenceId") REFERENCES "Licence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affiliation" ADD CONSTRAINT "Affiliation_licenceId_fkey" FOREIGN KEY ("licenceId") REFERENCES "Licence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affiliation" ADD CONSTRAINT "Affiliation_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisterAction" ADD CONSTRAINT "RegisterAction_licenceId_fkey" FOREIGN KEY ("licenceId") REFERENCES "Licence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictDeclaration" ADD CONSTRAINT "ConflictDeclaration_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictDeclaration" ADD CONSTRAINT "ConflictDeclaration_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Number sequences (FR-A-001 reference numbers, FR-N-001 registration numbers, licence, receipt
-- and letter numbers). Sequences never roll back, so numbers are unique even across retries.
CREATE SEQUENCE application_ref_seq;
CREATE SEQUENCE registrant_person_seq;
CREATE SEQUENCE registrant_firm_seq;
CREATE SEQUENCE licence_seq;
CREATE SEQUENCE receipt_seq;
CREATE SEQUENCE letter_seq;

-- FR-REG-002: typo-tolerant register search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "RegisterEntry_searchText_trgm" ON "RegisterEntry" USING gin ("searchText" gin_trgm_ops);

-- FR-RA-002: licence history is append-only.
CREATE OR REPLACE FUNCTION licence_event_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'LicenceEvent is append-only (% blocked)', TG_OP USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER licence_event_no_update
  BEFORE UPDATE OR DELETE ON "LicenceEvent"
  FOR EACH ROW EXECUTE FUNCTION licence_event_block_mutation();
