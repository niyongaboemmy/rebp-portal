import { beforeEach, describe, expect, it } from "vitest";
import type { ApplicationData } from "@rebp/contracts";
import {
  asData,
  createApplication,
  saveSection,
  withdrawApplication,
} from "@/server/applications/applications";
import {
  readiness,
  requestSignature,
  signAndSubmit,
  verifySnapshot,
} from "@/server/applications/submission";
import { assertCanDecide } from "@/server/backoffice/decision";
import { assignTo } from "@/server/backoffice/assignment";
import { overrideConfirmation } from "@/server/confirmations/confirmations";
import { setDocumentVerdict } from "@/server/documents/documents";
import { resetEnvCache } from "@/server/env";
import { recordDecision } from "@/server/backoffice/decision";
import {
  computedReview,
  requestInformation,
  saveReview,
  signReview,
  startReview,
} from "@/server/backoffice/review";
import { decideConfig, getConfig, proposeConfig } from "@/server/config/config";
import { respondToConfirmations } from "@/server/confirmations/confirmations";
import { db } from "@/server/db";
import { uploadDocument } from "@/server/documents/documents";
import { AppError } from "@/server/errors";
import { runLicenceLifecycle } from "@/server/jobs/lifecycle";
import { certificateFor } from "@/server/licensing/official-documents";
import { decideRegisterAction, proposeRegisterAction } from "@/server/licensing/register-admin";
import { findRegisterEntry, searchRegister } from "@/server/licensing/register";
import { gateway, simulatedEvent } from "@/server/payments/gateway";
import { processWebhook, simulateCheckout, startPayment } from "@/server/payments/payments";
import { ctx, latestCode, resetDatabase } from "@/test/db";
import {
  EICAR,
  makeFirmWithPeople,
  makeLicence,
  makeUser,
  PASSWORD,
  pdfOf,
  pngOf,
} from "@/test/fixtures";

/**
 * The end-to-end licensing loop through the domain layer (Plan O1, WP-3.10, SRS §19.2):
 * draft → documents → signature → payment → confirmations → review → decision → licence →
 * public register → register administration → renewal lifecycle.
 */
async function expectAppError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy(
    (error) => error instanceof AppError && error.code === code,
  );
}

function fslaData(firmId: string, supervisorNo: string): ApplicationData {
  return {
    b: {
      surname: "Uwase",
      givenNames: "Aline",
      idType: "NATIONAL_ID",
      idNumber: "1199880012345678",
      dateOfBirth: "1998-04-02",
      nationality: ["RW"],
      phone: "0788123456",
      email: "aline@example.rw",
      residentialAddress: { province: "1", district: "12", sector: "1208" },
      professionalSameAsResidential: true,
      occupation: "Sales agent",
    },
    c: {
      highestLevel: "A2",
      qualifications: [
        {
          id: "q1",
          institution: "GS Kigali",
          qualification: "A2 certificate",
          fieldOfStudy: "GENERAL_SECONDARY",
          yearCompleted: 2016,
          isForeign: false,
          reliedUpon: true,
        },
      ],
    },
    d: {
      trainingCompleted: true,
      trainingProvider: "PBTI",
      trainingProgramme: "ENTRY",
      trainingCompletedOn: "2026-03-01",
      trainingCertificateNo: "PBTI-ENT-123",
      examPassed: "NOT_APPLICABLE",
    },
    f: {
      isAffiliated: true,
      firmId,
      supervisorLicenceNo: supervisorNo,
      affiliationStart: "2026-10-01",
    },
    g: { territory: ["12"], restrictionsAck: true },
    h: {
      criminalConviction: false,
      disciplinarySanction: false,
      licenceRevoked: false,
      currentRestriction: false,
      criminalRecordIssuedOn: new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10),
      codeOfConduct: true,
    },
  };
}

async function draftFsla() {
  const people = await makeFirmWithPeople();
  const applicant = await makeUser(["APPLICANT"], { fullName: "Aline Uwase" });
  const app = await createApplication(applicant.user, { type: "NEW", category: "FSLA" }, ctx);
  const data = fslaData(people.firm.id, people.supervisorLicence.licenceNo);
  for (const section of ["b", "c", "d", "f", "g", "h"] as const)
    await saveSection(app.id, { section, data: data[section] as never }, applicant.user, ctx);
  const upload = (type: string, bytes: Buffer, fileName = `${type}.pdf`) =>
    uploadDocument({ applicationId: app.id, type, fileName, bytes }, applicant.user, ctx);
  await upload("photo", pngOf(), "photo.png");
  for (const type of [
    "proofOfIdentity",
    "educationCertificate",
    "trainingCertificate",
    "criminalRecord",
    "affiliationEvidence",
  ])
    await upload(type, pdfOf(type));
  return { people, applicant, app };
}

async function submitAndPay(
  applicationId: string,
  user: Awaited<ReturnType<typeof makeUser>>["user"],
) {
  await requestSignature(applicationId, "EMAIL", user);
  const code = await latestCode(user.email, "signatureCode");
  await signAndSubmit(applicationId, { code, method: "EMAIL" }, user, ctx);
  const { reference } = await startPayment(applicationId, "MOBILE_MONEY", "0788123456", user, ctx);
  await simulateCheckout(reference, "success", user);
  return reference;
}

beforeEach(resetDatabase);

describe("FSLA end-to-end licensing loop", () => {
  it("goes from draft to a public register entry with every control applied", async () => {
    const { people, applicant, app } = await draftFsla();
    const officer = await makeUser(["REVIEWING_OFFICER"], { fullName: "Jean Officer" });
    const approver = await makeUser(["APPROVING_AUTHORITY"], { fullName: "Diane Approver" });

    // FR-WIZ-013: complete and eligible.
    const ready = await readiness(
      await db.application.findUniqueOrThrow({ where: { id: app.id } }),
    );
    expect(ready.sections.every((s) => s.issues === 0)).toBe(true);
    expect(ready.missingDocuments).toBe(0);
    expect(ready.canSubmit).toBe(true);

    // FR-J-004 + BR-081: sign, then pay.
    const reference = await submitAndPay(app.id, applicant.user);
    let current = await db.application.findUniqueOrThrow({ where: { id: app.id } });
    expect(current.status).toBe("PENDING_CONFIRMATIONS");
    const payment = await db.payment.findUniqueOrThrow({ where: { reference } });
    expect(payment.status).toBe("PAID");
    expect(payment.receiptNo).toMatch(/^RCT-\d{4}-\d{6}$/);
    expect(payment.amount).toBe(45_000);

    // FR-PAY-005: a replayed webhook is ignored.
    const event = simulatedEvent("success", payment, "MOBILE_MONEY", "evt_replay_1");
    const body = JSON.stringify(event);
    expect(await processWebhook(body, gateway.sign(body))).toBe("processed");
    expect(await processWebhook(body, gateway.sign(body))).toBe("duplicate");
    await expectAppError(processWebhook(body, "sha256=forged"), "invalidSignature");

    // FR-F-007: supervisor and Principal Broker each confirm.
    const requests = await db.confirmationRequest.findMany({ where: { applicationId: app.id } });
    expect(requests.map((r) => r.kind).sort()).toEqual(["PRINCIPAL_BROKER", "SUPERVISOR"]);
    for (const request of requests) {
      const addressee =
        request.addresseeId === people.supervisor.user.id
          ? people.supervisor.user
          : people.principal.user;
      await respondToConfirmations([request.id], true, undefined, addressee, ctx);
    }
    current = await db.application.findUniqueOrThrow({ where: { id: app.id } });
    expect(current.status).toBe("SUBMITTED");
    expect(current.submittedAt).not.toBeNull();
    expect(current.assignedOfficerId).toBe(officer.user.id);
    expect(
      await db.notification.count({ where: { userId: applicant.user.id, code: "N-011" } }),
    ).toBe(1);

    // Section L.
    await startReview(app.id, officer.user, ctx);
    const computed = await computedReview(
      await db.application.findUniqueOrThrow({ where: { id: app.id } }),
    );
    expect(computed.documentation).toBe("COMPLETE");
    expect(computed.eligibilityOutcome).toBe("SATISFIED");
    const checks = Object.fromEntries(
      ["identity", "education", "experience", "trainingExam", "affiliation", "integrity"].map(
        (k) => [k, { outcome: k === "experience" ? "NA" : "VERIFIED" }],
      ),
    );
    await saveReview(
      {
        applicationId: app.id,
        checks: checks as never,
        documentation: "COMPLETE",
        eligibility: "NOT_SATISFIED",
        recommendation: "APPROVE",
      },
      officer.user,
    );
    // BR-090: overriding the computed eligibility without a reason is rejected.
    await expectAppError(
      signReview(app.id, PASSWORD, officer.user, officer.session, ctx),
      "reviewIncomplete",
    );
    await saveReview(
      {
        applicationId: app.id,
        checks: checks as never,
        documentation: "COMPLETE",
        eligibility: "SATISFIED",
        recommendation: "APPROVE",
        internalComment: "All good",
      },
      officer.user,
    );
    await signReview(app.id, PASSWORD, officer.user, officer.session, ctx);
    current = await db.application.findUniqueOrThrow({ where: { id: app.id } });
    expect(current.status).toBe("PENDING_DECISION");

    // BR-091: the reviewer can never decide.
    await expectAppError(assertCanDecide(app.id, officer.user), "segregationOfDuties");

    // Section M + N.
    const { licenceId } = await recordDecision(
      {
        applicationId: app.id,
        decision: "APPROVED",
        conditions: [],
        geoScope: [],
        reasonCodes: [],
        password: PASSWORD,
      },
      approver.user,
      approver.session,
      ctx,
    );
    expect(licenceId).not.toBeNull();
    current = await db.application.findUniqueOrThrow({ where: { id: app.id } });
    expect(current.status).toBe("LICENSE_ISSUED");
    const licence = await db.licence.findUniqueOrThrow({
      where: { id: licenceId! },
      include: { registrant: true },
    });
    expect(licence.licenceNo).toMatch(/^FSL-\d{4}-\d{5}$/);
    expect(licence.registrant.registrationNo).toMatch(/^RP-\d{6}$/);
    expect(licence.supervisorLicenceId).toBe(people.supervisorLicence.id);
    expect(licence.affiliatedFirmId).toBe(people.firm.id);
    expect(licence.scope).toEqual(["12"]);

    // FR-REG-003/004: public projection, no personal data, QR resolves.
    const found = await findRegisterEntry(licence.qrToken);
    expect(found?.entry?.status).toBe("ACTIVE");
    const publicKeys = Object.keys(found!.entry!);
    for (const forbidden of ["idNumber", "dateOfBirth", "email", "phone", "residentialAddress"])
      expect(publicKeys).not.toContain(forbidden);
    expect(
      (await searchRegister({ q: "alin uwse" })).entries.some((e) => e.licenceId === licence.id),
    ).toBe(true);

    // FR-N-002: a real PDF certificate.
    const certificate = await certificateFor(licence.id, applicant.user);
    expect(Buffer.from(certificate.bytes).subarray(0, 5).toString()).toBe("%PDF-");

    // DATA-002: the signed snapshot verifies; tampering breaks it.
    const snapshot = await db.applicationSnapshot.findFirstOrThrow({
      where: { applicationId: app.id },
    });
    expect((await verifySnapshot(snapshot.id)).ok).toBe(true);
    await db.applicationSnapshot.update({
      where: { id: snapshot.id },
      data: { data: { ...(snapshot.data as object), tampered: true } },
    });
    expect((await verifySnapshot(snapshot.id)).ok).toBe(false);

    // FR-RA-001 (UAT-09): suspend is immediate; revoke needs a second person.
    const registrar = await makeUser(["REGISTRAR"]);
    await proposeRegisterAction(
      {
        licenceId: licence.id,
        action: "SUSPEND",
        reason: "Pending disciplinary hearing",
        reference: "DC-2026-01",
        startsOn: "2026-10-15",
      },
      registrar.user,
      ctx,
    );
    expect((await findRegisterEntry(licence.licenceNo))?.entry?.status).toBe("SUSPENDED");
    await proposeRegisterAction(
      {
        licenceId: licence.id,
        action: "LIFT",
        reason: "Hearing concluded, no sanction",
        reference: "DC-2026-01",
      },
      registrar.user,
      ctx,
    );
    const revoke = await proposeRegisterAction(
      {
        licenceId: licence.id,
        action: "REVOKE",
        reason: "Fraudulent documents confirmed",
        reference: "DC-2026-02",
      },
      registrar.user,
      ctx,
    );
    expect(revoke.applied).toBe(false);
    const pending = await db.registerAction.findFirstOrThrow({
      where: { licenceId: licence.id, status: "PENDING" },
    });
    await expectAppError(
      decideRegisterAction(pending.id, true, undefined, registrar.user, ctx),
      "makerChecker",
    );
    await decideRegisterAction(pending.id, true, "Confirmed", approver.user, ctx);
    expect((await findRegisterEntry(licence.licenceNo))?.entry?.status).toBe("REVOKED");
  }, 60_000);
});

describe("controls and branches", () => {
  it("blocks submission until eligible (UAT under-age) and rejects bad uploads", async () => {
    const { applicant, app } = await draftFsla();
    await saveSection(
      app.id,
      { section: "b", data: { ...fslaData("x", "y").b, dateOfBirth: "2012-01-01" } },
      applicant.user,
      ctx,
    );
    const ready = await readiness(
      await db.application.findUniqueOrThrow({ where: { id: app.id } }),
    );
    expect(ready.eligibility.outcome).toBe("FAIL");
    expect(ready.canSubmit).toBe(false);
    await expectAppError(requestSignature(app.id, "EMAIL", applicant.user), "notReadyToSubmit");

    // FR-DOC-003/004: mismatched extension, malware, too small photo.
    const upload = (type: string, bytes: Buffer, fileName: string) =>
      uploadDocument({ applicationId: app.id, type, fileName, bytes }, applicant.user, ctx);
    await expectAppError(upload("proofOfIdentity", pdfOf(), "id.png"), "fileExtensionMismatch");
    await expectAppError(
      upload("proofOfIdentity", Buffer.from("plain text"), "id.pdf"),
      "fileTypeInvalid",
    );
    await expectAppError(upload("photo", pngOf(300, 300), "small.png"), "photoTooSmall");
    const infected = await upload(
      "proofOfIdentity",
      Buffer.from(`%PDF-1.4\n${EICAR}\n%%EOF`),
      "virus.pdf",
    );
    expect(infected.status).toBe("INFECTED");
    const active = await upload(
      "proofOfIdentity",
      Buffer.from("%PDF-1.4\n/JavaScript (app.alert(1))\n%%EOF"),
      "script.pdf",
    );
    expect(active.status).toBe("REJECTED_FILE");

    // FR-DOC-007: replacing keeps the previous version.
    const doc = await db.document.findFirstOrThrow({
      where: { applicationId: app.id, type: "criminalRecord" },
    });
    await uploadDocument(
      {
        applicationId: app.id,
        type: "criminalRecord",
        replaceId: doc.id,
        fileName: "new.pdf",
        bytes: pdfOf("v2"),
      },
      applicant.user,
      ctx,
    );
    expect(await db.documentVersion.count({ where: { documentId: doc.id } })).toBe(2);
  });

  it("a declined confirmation sends the application back with Section F unlocked", async () => {
    const { people, applicant, app } = await draftFsla();
    await submitAndPay(app.id, applicant.user);
    const supervisorRequest = await db.confirmationRequest.findFirstOrThrow({
      where: { applicationId: app.id, kind: "SUPERVISOR" },
    });
    await expectAppError(
      respondToConfirmations([supervisorRequest.id], false, undefined, people.supervisor.user, ctx),
      "reasonRequired",
    );
    await respondToConfirmations(
      [supervisorRequest.id],
      false,
      "I don't supervise this person",
      people.supervisor.user,
      ctx,
    );
    const current = await db.application.findUniqueOrThrow({ where: { id: app.id } });
    expect(current.status).toBe("ACTION_REQUIRED");
    expect(current.unlockedSections).toEqual(["f"]);
    await expectAppError(
      saveSection(app.id, { section: "b", data: {} }, applicant.user, ctx),
      "sectionLocked",
    );
  });

  it("information request round trip unlocks only the named items (UAT-07)", async () => {
    const { people, applicant, app } = await draftFsla();
    const officer = await makeUser(["REVIEWING_OFFICER"]);
    await submitAndPay(app.id, applicant.user);
    for (const r of await db.confirmationRequest.findMany({ where: { applicationId: app.id } }))
      await respondToConfirmations(
        [r.id],
        true,
        undefined,
        r.addresseeId === people.supervisor.user.id
          ? people.supervisor.user
          : people.principal.user,
        ctx,
      );
    await startReview(app.id, officer.user, ctx);
    await requestInformation(
      {
        applicationId: app.id,
        template: "missingDocument",
        message: "Please upload a clearer ID copy.",
        sections: ["c"],
        documents: ["proofOfIdentity"],
        dueInDays: 14,
      },
      officer.user,
      ctx,
    );
    let current = await db.application.findUniqueOrThrow({ where: { id: app.id } });
    expect(current.status).toBe("ACTION_REQUIRED");
    await expectAppError(
      saveSection(app.id, { section: "b", data: {} }, applicant.user, ctx),
      "sectionLocked",
    );
    await expectAppError(
      uploadDocument(
        { applicationId: app.id, type: "criminalRecord", fileName: "x.pdf", bytes: pdfOf() },
        applicant.user,
        ctx,
      ),
      "sectionLocked",
    );
    await uploadDocument(
      {
        applicationId: app.id,
        type: "proofOfIdentity",
        fileName: "id2.pdf",
        bytes: pdfOf("clear"),
      },
      applicant.user,
      ctx,
    );
    await requestSignature(app.id, "EMAIL", applicant.user);
    await signAndSubmit(
      app.id,
      { code: await latestCode(applicant.user.email, "signatureCode"), method: "EMAIL" },
      applicant.user,
      ctx,
    );
    current = await db.application.findUniqueOrThrow({ where: { id: app.id } });
    expect(current.status).toBe("UNDER_REVIEW");
    expect(current.unlockedSections).toEqual([]);
    expect(await db.applicationSnapshot.count({ where: { applicationId: app.id } })).toBe(2);
  });

  it("withdrawal cancels pending confirmations (FR-WF-005)", async () => {
    const { applicant, app } = await draftFsla();
    await submitAndPay(app.id, applicant.user);
    await withdrawApplication(app.id, applicant.user, ctx);
    expect((await db.application.findUniqueOrThrow({ where: { id: app.id } })).status).toBe(
      "WITHDRAWN",
    );
    expect(
      await db.confirmationRequest.count({ where: { applicationId: app.id, status: "PENDING" } }),
    ).toBe(0);
  });

  it("an officer in the applicant's firm is never auto-assigned (BR-093)", async () => {
    const { people, applicant, app } = await draftFsla();
    // The supervisor also works as a reviewing officer: they hold a licence in the same firm.
    await db.user.update({
      where: { id: people.supervisor.user.id },
      data: { roles: ["SUPERVISOR", "REVIEWING_OFFICER"], mfaMethods: ["TOTP"] },
    });
    const neutral = await makeUser(["REVIEWING_OFFICER"]);
    await submitAndPay(app.id, applicant.user);
    for (const r of await db.confirmationRequest.findMany({ where: { applicationId: app.id } }))
      await respondToConfirmations(
        [r.id],
        true,
        undefined,
        r.addresseeId === people.supervisor.user.id
          ? people.supervisor.user
          : people.principal.user,
        ctx,
      );
    expect(
      (await db.application.findUniqueOrThrow({ where: { id: app.id } })).assignedOfficerId,
    ).toBe(neutral.user.id);
  });
});

describe("renewal lifecycle (WP-4.1 time travel, UAT-10)", () => {
  it("reminds, keeps a timely renewal active, then expires and lapses an unrenewed licence", async () => {
    const holder = await makeUser(["APPLICANT"]);
    const renewed = await makeLicence(holder.user.id, "FSLA", {
      issuedAt: "2025-11-01",
      expiresAt: "2026-11-01",
    });
    const other = await makeUser(["APPLICANT"]);
    const unrenewed = await makeLicence(other.user.id, "FSLA", {
      issuedAt: "2025-11-01",
      expiresAt: "2026-11-01",
    });
    const at = (iso: string) => new Date(`${iso}T08:00:00+02:00`);

    let summary = await runLicenceLifecycle(at("2026-10-05"));
    expect(summary.reminders).toBe(2);
    expect((await runLicenceLifecycle(at("2026-10-05"))).reminders).toBe(0); // de-duplicated

    // A renewal signed before expiry (BR-041).
    const renewal = await createApplication(
      holder.user,
      { type: "RENEWAL", category: "FSLA", relatedLicenceId: renewed.id },
      ctx,
    );
    await db.application.update({
      where: { id: renewal.id },
      data: { status: "UNDER_REVIEW", signedAt: at("2026-10-20") },
    });

    summary = await runLicenceLifecycle(at("2026-11-03"));
    expect(summary.expired).toBe(1);
    expect(summary.keptActive).toBe(1);
    expect((await db.licence.findUniqueOrThrow({ where: { id: renewed.id } })).status).toBe(
      "ACTIVE",
    );
    expect((await db.licence.findUniqueOrThrow({ where: { id: unrenewed.id } })).status).toBe(
      "EXPIRED",
    );
    expect((await findRegisterEntry(unrenewed.licenceNo))?.entry?.status).toBe("EXPIRED");

    summary = await runLicenceLifecycle(at("2026-12-05"));
    expect(summary.lapsed).toBe(1);
    expect((await db.licence.findUniqueOrThrow({ where: { id: unrenewed.id } })).status).toBe(
      "LAPSED",
    );
    expect(
      await db.notification.count({ where: { userId: other.user.id, code: "N-070" } }),
    ).toBeGreaterThanOrEqual(3);
  });
});

describe("configuration maker-checker (FR-ADM-003, FR-ELG-002)", () => {
  it("applies a threshold change only after a different person approves it", async () => {
    const maker = await makeUser(["SYSTEM_ADMIN"]);
    const checker = await makeUser(["APPROVING_AUTHORITY"]);
    const before = await getConfig("thresholds");
    expect(before.version).toBe(0);
    const row = await proposeConfig(
      {
        key: "thresholds",
        value: { ...before.value, reaExperienceMonths: 24 },
        effectiveFrom: "2026-01-01",
        reason: "SME decision D-012",
      },
      maker.user,
      ctx,
    );
    expect((await getConfig("thresholds")).value.reaExperienceMonths).toBe(36);
    await expectAppError(decideConfig(row.id, true, undefined, maker.user, ctx), "makerChecker");
    await decideConfig(row.id, true, "Approved", checker.user, ctx);
    const after = await getConfig("thresholds");
    expect(after.version).toBe(1);
    expect(after.value.reaExperienceMonths).toBe(24);
  });
});

// ---------------------------------------------------------------------------
// Other journeys: REBF firm registration (O1), renewal and upgrade issuance
// ---------------------------------------------------------------------------

type Person = Awaited<ReturnType<typeof makeUser>>;

/** Officer review (all checks verified, approve) and approver decision, through the domain. */
async function reviewAndApprove(applicationId: string, officer: Person, approver: Person) {
  await startReview(applicationId, officer.user, ctx);
  const checks = Object.fromEntries(
    ["identity", "education", "experience", "trainingExam", "affiliation", "integrity"].map((k) => [
      k,
      { outcome: k === "identity" ? "VERIFIED" : "NA" },
    ]),
  );
  const computed = await computedReview(
    await db.application.findUniqueOrThrow({ where: { id: applicationId } }),
  );
  await saveReview(
    {
      applicationId,
      checks: checks as never,
      documentation: computed.documentation,
      eligibility: computed.eligibilityOutcome,
      recommendation: "APPROVE",
    },
    officer.user,
  );
  await signReview(applicationId, PASSWORD, officer.user, officer.session, ctx);
  return recordDecision(
    {
      applicationId,
      decision: "APPROVED",
      conditions: [],
      geoScope: [],
      reasonCodes: [],
      password: PASSWORD,
    },
    approver.user,
    approver.session,
    ctx,
  );
}

async function signAndPay(applicationId: string, user: Person["user"]) {
  await requestSignature(applicationId, "EMAIL", user);
  await signAndSubmit(
    applicationId,
    { code: await latestCode(user.email, "signatureCode"), method: "EMAIL", capacity: "Director" },
    user,
    ctx,
  );
  const app = await db.application.findUniqueOrThrow({ where: { id: applicationId } });
  if (app.status === "PENDING_PAYMENT") {
    const { reference } = await startPayment(applicationId, "CARD", undefined, user, ctx);
    await simulateCheckout(reference, "success", user);
  }
}

describe("REBF firm registration (Plan O1, G8, BR-032)", () => {
  it("registers a firm with its Principal Broker's confirmation and issues an RF registration", async () => {
    const people = await makeFirmWithPeople();
    const firmAccount = await makeUser(["APPLICANT"], {
      accountType: "ORGANISATION",
      fullName: "Nyota Homes Ltd",
    });
    const officer = await makeUser(["REVIEWING_OFFICER"]);
    const approver = await makeUser(["APPROVING_AUTHORITY"]);
    const app = await createApplication(
      firmAccount.user,
      { type: "FIRM_REGISTRATION", category: "REBF" },
      ctx,
    );
    const office = { province: "1", district: "12", sector: "1208" };
    await saveSection(
      app.id,
      {
        section: "g",
        data: {
          legalName: "Nyota Homes Ltd",
          tradingName: "Nyota Homes",
          legalForm: "PRIVATE_LIMITED",
          companyRegNo: `RDB-N${Date.now()}`,
          incorporatedOn: "2024-02-01",
          registeredOffice: office,
          placeSameAsOffice: true,
          phone: "0788000111",
          email: "info@nyota.example.rw",
          responsiblePersons: [
            {
              id: "p1",
              name: "Jeanne Uwera",
              role: "Director",
              idType: "NATIONAL_ID",
              idNumber: "1198870012345678",
              nationality: "RW",
            },
          ],
          principalBrokerLicenceNo: people.pb.licenceNo,
          branches: [{ id: "b1", name: "Remera branch", address: office }],
          indemnity: {
            insurer: "Sanlam",
            policyNo: "PI-1",
            cover: 50_000_000,
            from: "2026-01-01",
            to: "2027-12-31",
          },
          clientFundsApplicable: false,
          hasSupervisoryManual: true,
        },
      },
      firmAccount.user,
      ctx,
    );
    await saveSection(
      app.id,
      {
        section: "h",
        data: {
          criminalConviction: false,
          disciplinarySanction: false,
          licenceRevoked: false,
          currentRestriction: false,
          criminalRecordIssuedOn: new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10),
          codeOfConduct: true,
        },
      },
      firmAccount.user,
      ctx,
    );
    for (const type of [
      "companyRegistration",
      "fullRegistrationInfo",
      "businessAddressProof",
      "supervisorySystems",
      "directorsIdentity",
      "indemnityInsurance",
      "criminalRecord",
    ])
      await uploadDocument(
        { applicationId: app.id, type, fileName: `${type}.pdf`, bytes: pdfOf(type) },
        firmAccount.user,
        ctx,
      );

    const ready = await readiness(
      await db.application.findUniqueOrThrow({ where: { id: app.id } }),
    );
    expect(ready.sections.filter((s) => s.issues > 0)).toEqual([]);
    expect(ready.canSubmit).toBe(true);

    await signAndPay(app.id, firmAccount.user);
    // FR-G8-008: the proposed Principal Broker confirms the designation.
    const designation = await db.confirmationRequest.findFirstOrThrow({
      where: { applicationId: app.id },
    });
    expect(designation.kind).toBe("DESIGNATION");
    expect(designation.addresseeId).toBe(people.principal.user.id);
    await respondToConfirmations([designation.id], true, undefined, people.principal.user, ctx);

    const { licenceId } = await reviewAndApprove(app.id, officer, approver);
    const licence = await db.licence.findUniqueOrThrow({
      where: { id: licenceId! },
      include: { registrant: true, firm: { include: { branches: true } } },
    });
    expect(licence.category).toBe("REBF");
    expect(licence.registrant.registrationNo).toMatch(/^RF-\d{6}$/);
    expect(licence.firm?.status).toBe("ACTIVE");
    expect(licence.firm?.principalLicenceId).toBe(people.pb.id);
    expect(licence.firm?.branches.map((b) => b.name)).toEqual(["Remera branch"]);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: firmAccount.user.id } })).roles,
    ).toContain("FIRM_ADMIN");
    const entry = await findRegisterEntry(licence.licenceNo);
    expect(entry?.entry?.principalName).toBe("Grace Principal");
  }, 60_000);
});

describe("renewal and upgrade issuance (FR-REN-002, FR-WF-012)", () => {
  it("renews the same licence, extends it a year and supersedes the old QR (FR-N-012)", async () => {
    const holder = await makeUser(["APPLICANT"]);
    const officer = await makeUser(["REVIEWING_OFFICER"]);
    const approver = await makeUser(["APPROVING_AUTHORITY"]);
    const expiresAt = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10);
    const licence = await makeLicence(holder.user.id, "FSLA", {
      issuedAt: "2025-11-01",
      expiresAt,
    });
    const app = await createApplication(
      holder.user,
      { type: "RENEWAL", category: "FSLA", relatedLicenceId: licence.id },
      ctx,
    );
    await saveSection(app.id, { section: "b", data: fslaData("x", "y").b! }, holder.user, ctx);
    await saveSection(
      app.id,
      {
        section: "f",
        data: {
          isAffiliated: false,
          firmName: "Own Agency",
          supervisorLicenceNo: "TST-BRO-1",
          affiliationStart: "2026-10-01",
        },
      },
      holder.user,
      ctx,
    );
    await saveSection(app.id, { section: "h", data: fslaData("x", "y").h! }, holder.user, ctx);
    await uploadDocument(
      { applicationId: app.id, type: "photo", fileName: "p.png", bytes: pngOf() },
      holder.user,
      ctx,
    );
    await uploadDocument(
      { applicationId: app.id, type: "criminalRecord", fileName: "r.pdf", bytes: pdfOf() },
      holder.user,
      ctx,
    );
    await signAndPay(app.id, holder.user);
    const payment = await db.payment.findFirstOrThrow({ where: { applicationId: app.id } });
    expect(payment.amount).toBe(30_000); // renewal fee only, no late penalty
    expect((await db.application.findUniqueOrThrow({ where: { id: app.id } })).status).toBe(
      "SUBMITTED",
    );

    await reviewAndApprove(app.id, officer, approver);
    const renewed = await db.licence.findUniqueOrThrow({ where: { id: licence.id } });
    expect(renewed.licenceNo).toBe(licence.licenceNo);
    expect(renewed.certificateVersion).toBe(2);
    expect(renewed.expiresAt.toISOString().slice(0, 10)).toBe(
      `${Number(expiresAt.slice(0, 4)) + 1}${expiresAt.slice(4)}`,
    );
    expect(await findRegisterEntry(licence.qrToken)).toEqual({
      entry: null,
      superseded: true,
      current: licence.licenceNo,
    });
  }, 60_000);

  it("an approved upgrade supersedes the lower licence", async () => {
    const people = await makeFirmWithPeople();
    const holder = await makeUser(["APPLICANT"]);
    const officer = await makeUser(["REVIEWING_OFFICER"]);
    const approver = await makeUser(["APPROVING_AUTHORITY"]);
    const fsla = await makeLicence(holder.user.id, "FSLA", {
      issuedAt: "2021-01-01",
      expiresAt: "2027-01-01",
      affiliatedFirmId: people.firm.id,
    });
    const app = await createApplication(holder.user, { type: "UPGRADE", category: "REA" }, ctx);
    expect(app.relatedLicenceId).toBe(fsla.id);
    const base = fslaData(people.firm.id, people.supervisorLicence.licenceNo);
    const data: ApplicationData = {
      ...base,
      c: {
        highestLevel: "BACHELOR",
        qualifications: [
          {
            id: "q",
            institution: "UR",
            qualification: "BBA",
            fieldOfStudy: "BUSINESS",
            yearCompleted: 2019,
            isForeign: false,
            reliedUpon: true,
          },
        ],
      },
      d: {
        trainingCompleted: true,
        trainingProvider: "PBTI",
        trainingProgramme: "PROFESSIONAL",
        trainingCompletedOn: "2026-02-01",
        trainingCertificateNo: "P-1",
        examPassed: "YES",
        examReference: "EX-1",
        examDate: "2026-03-01",
      },
      // Section E arrives pre-filled from the register; the applicant adds the duties (FR-WIZ-010).
      e: (() => {
        const prefilled = asData(app.data).e!;
        return {
          ...prefilled,
          equivalentRecognised: false,
          records: prefilled.records!.map((r) => ({ ...r, duties: "Field sales" })),
        };
      })(),
      g: { dataConfirmed: true },
    };
    for (const section of ["b", "c", "d", "e", "f", "g", "h"] as const)
      await saveSection(app.id, { section, data: data[section] as never }, holder.user, ctx);
    for (const type of [
      "proofOfIdentity",
      "educationCertificate",
      "trainingCertificate",
      "examResult",
      "experienceEvidence",
      "criminalRecord",
      "affiliationEvidence",
    ])
      await uploadDocument(
        { applicationId: app.id, type, fileName: `${type}.pdf`, bytes: pdfOf(type) },
        holder.user,
        ctx,
      );
    await uploadDocument(
      { applicationId: app.id, type: "photo", fileName: "p.png", bytes: pngOf() },
      holder.user,
      ctx,
    );
    // Experience comes from the register: 5+ years of licensed FSLA practice (FR-E-007).
    const ready = await readiness(
      await db.application.findUniqueOrThrow({ where: { id: app.id } }),
    );
    expect(ready.eligibility.rules.find((r) => r.id === "BR-020")?.outcome).toBe("PASS");
    expect({
      sections: ready.sections.filter((s) => s.issues > 0),
      missing: ready.missingDocuments,
      fails: ready.eligibility.rules.filter((r) => r.outcome === "FAIL").map((r) => r.message),
    }).toEqual({ sections: [], missing: 0, fails: [] });
    expect(ready.canSubmit).toBe(true);
    await signAndPay(app.id, holder.user);
    for (const r of await db.confirmationRequest.findMany({ where: { applicationId: app.id } }))
      await respondToConfirmations(
        [r.id],
        true,
        undefined,
        r.addresseeId === people.supervisor.user.id
          ? people.supervisor.user
          : people.principal.user,
        ctx,
      );
    const { licenceId } = await reviewAndApprove(app.id, officer, approver);
    expect((await db.licence.findUniqueOrThrow({ where: { id: fsla.id } })).status).toBe(
      "SUPERSEDED",
    );
    expect((await db.licence.findUniqueOrThrow({ where: { id: licenceId! } })).category).toBe(
      "REA",
    );
    expect((await db.user.findUniqueOrThrow({ where: { id: holder.user.id } })).roles).toContain(
      "SUPERVISOR",
    );
  }, 60_000);
});

describe("security review regressions (WP-5.1)", () => {
  async function submittedFsla() {
    const flow = await draftFsla();
    await submitAndPay(flow.app.id, flow.applicant.user);
    for (const r of await db.confirmationRequest.findMany({
      where: { applicationId: flow.app.id },
    }))
      await respondToConfirmations(
        [r.id],
        true,
        undefined,
        r.addresseeId === flow.people.supervisor.user.id
          ? flow.people.supervisor.user
          : flow.people.principal.user,
        ctx,
      );
    return flow;
  }

  it("H1: the sandbox checkout refuses to run in production", async () => {
    const { applicant, app } = await draftFsla();
    await requestSignature(app.id, "EMAIL", applicant.user);
    await signAndSubmit(
      app.id,
      { code: await latestCode(applicant.user.email, "signatureCode"), method: "EMAIL" },
      applicant.user,
      ctx,
    );
    const { reference } = await startPayment(app.id, "CARD", undefined, applicant.user, ctx);
    const previous = process.env.APP_ENV;
    process.env.APP_ENV = "production";
    resetEnvCache();
    try {
      await expectAppError(simulateCheckout(reference, "success", applicant.user), "forbidden");
    } finally {
      process.env.APP_ENV = previous;
      resetEnvCache();
    }
    expect((await db.payment.findUniqueOrThrow({ where: { reference } })).status).toBe("PENDING");
  });

  it("M1: an officer with a conflict cannot override a confirmation", async () => {
    const { people, applicant, app } = await draftFsla();
    await submitAndPay(app.id, applicant.user);
    // The supervisor is also a reviewing officer: a conflict on this application (BR-093).
    await db.user.update({
      where: { id: people.supervisor.user.id },
      data: { roles: ["SUPERVISOR", "REVIEWING_OFFICER"] },
    });
    const request = await db.confirmationRequest.findFirstOrThrow({
      where: { applicationId: app.id, kind: "PRINCIPAL_BROKER" },
    });
    await expectAppError(
      overrideConfirmation(
        request.id,
        "Confirmed by phone call today",
        people.supervisor.user,
        ctx,
      ),
      "conflictOfInterest",
    );
  });

  it("M2: only the assigned officer can verify documents", async () => {
    await makeUser(["REVIEWING_OFFICER"]);
    const { app } = await submittedFsla();
    const intruder = await makeUser(["REVIEWING_OFFICER"]);
    const doc = await db.document.findFirstOrThrow({ where: { applicationId: app.id } });
    const assigned = (await db.application.findUniqueOrThrow({ where: { id: app.id } }))
      .assignedOfficerId;
    expect(assigned).not.toBe(intruder.user.id);
    await expectAppError(
      setDocumentVerdict(doc.id, "VERIFIED", undefined, intruder.user, ctx),
      "notAssigned",
    );
  });

  it("M3: no taking over a colleague's file, and past reviewers can never decide (BR-091)", async () => {
    const { user: firstOfficer } = await makeUser(["REVIEWING_OFFICER"]);
    const { app } = await submittedFsla();
    expect(
      (await db.application.findUniqueOrThrow({ where: { id: app.id } })).assignedOfficerId,
    ).toBe(firstOfficer.id);
    const colleague = await makeUser(["REVIEWING_OFFICER"]);
    await expectAppError(assignTo(app.id, colleague.user.id, colleague.user, ctx), "notAssigned");
    // The assigned officer hands the file on; they still count as its reviewer.
    await assignTo(app.id, colleague.user.id, firstOfficer, ctx);
    await expectAppError(assertCanDecide(app.id, firstOfficer), "segregationOfDuties");
  });
});
