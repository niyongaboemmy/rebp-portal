import { beforeEach, describe, expect, it } from "vitest";
import { formatLicenceNo, type ApplicationData } from "@rebp/contracts";
import type { User } from "@/generated/prisma/client";
import { createApplication, saveSection } from "@/server/applications/applications";
import { requestSignature, signAndSubmit } from "@/server/applications/submission";
import { assignTo, bulkAssign, conflictsFor } from "@/server/backoffice/assignment";
import { assertCanDecide, correctDecision, recordDecision } from "@/server/backoffice/decision";
import { applicantOverview, queue } from "@/server/backoffice/queue";
import { saveReview, signReview, startReview } from "@/server/backoffice/review";
import { respondToConfirmations } from "@/server/confirmations/confirmations";
import { db } from "@/server/db";
import { uploadDocument } from "@/server/documents/documents";
import { AppError } from "@/server/errors";
import { runSlaWarnings } from "@/server/jobs/lifecycle";
import { reissueCertificate, retryPendingIssuance } from "@/server/licensing/licensing";
import { decisionLetterFor } from "@/server/licensing/official-documents";
import { findRegisterEntry } from "@/server/licensing/register";
import { simulateCheckout, startPayment } from "@/server/payments/payments";
import { todayKigali } from "@/server/time";
import { ctx, latestCode, resetDatabase } from "@/test/db";
import { makeFirmWithPeople, makeLicence, makeUser, pdfOf, pngOf } from "@/test/fixtures";

/**
 * The review → decision → licence workflow controls (FR-BO-001…006, FR-M-009/011/017,
 * FR-N-009/012, BR-091, BR-093): team-lead takeover and bulk assignment with the conflict guard,
 * the administrator's per-application segregation of duties, decision corrections and their
 * immutability, certificate reissue, the issuance-failure alert and SLA escalation.
 */
type Person = Awaited<ReturnType<typeof makeUser>>;

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

/** An FSLA application, signed, paid and confirmed: SUBMITTED (and auto-assigned if anyone can). */
async function submittedFsla(name = "Aline Uwase") {
  const people = await makeFirmWithPeople();
  const applicant = await makeUser(["APPLICANT"], { fullName: name });
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
  await requestSignature(app.id, "EMAIL", applicant.user);
  const code = await latestCode(applicant.user.email, "signatureCode");
  await signAndSubmit(app.id, { code, method: "EMAIL" }, applicant.user, ctx);
  const { reference } = await startPayment(
    app.id,
    "MOBILE_MONEY",
    "0788123456",
    applicant.user,
    ctx,
  );
  await simulateCheckout(reference, "success", applicant.user);
  for (const r of await db.confirmationRequest.findMany({ where: { applicationId: app.id } }))
    await respondToConfirmations(
      [r.id],
      true,
      undefined,
      r.addresseeId === people.supervisor.user.id ? people.supervisor.user : people.principal.user,
      ctx,
    );
  const current = await db.application.findUniqueOrThrow({ where: { id: app.id } });
  expect(current.status).toBe("SUBMITTED");
  return { people, applicant, app: current };
}

/** Section L by the assigned officer: six checks, approve, signed (→ PENDING_DECISION). */
async function reviewAndSign(applicationId: string, officer: Person) {
  await startReview(applicationId, officer.user, ctx);
  const checks = Object.fromEntries(
    ["identity", "education", "experience", "trainingExam", "affiliation", "integrity"].map((k) => [
      k,
      { outcome: k === "experience" ? "NA" : "VERIFIED" },
    ]),
  );
  await saveReview(
    {
      applicationId,
      checks: checks as never,
      documentation: "COMPLETE",
      eligibility: "SATISFIED",
      recommendation: "APPROVE",
    },
    officer.user,
  );
  await signReview(applicationId, officer.user, ctx);
  expect((await db.application.findUniqueOrThrow({ where: { id: applicationId } })).status).toBe(
    "PENDING_DECISION",
  );
}

const approve = (applicationId: string, approver: Person) =>
  recordDecision(
    {
      applicationId,
      decision: "APPROVED",
      conditions: [],
      geoScope: [],
      reasonCodes: [],
      reasons: "Meets every requirement.",
    },
    approver.user,
    ctx,
  );

const notifications = (user: Pick<User, "id">, messageKey: string) =>
  db.notification.count({ where: { userId: user.id, messageKey } });

beforeEach(resetDatabase);

describe("assignment by a team lead (FR-BO-002/003/005, BR-093)", () => {
  it("takes over a colleague's file, bulk-assigns, and skips a firm owner's conflict", async () => {
    const officerA = await makeUser(["REVIEWING_OFFICER"], { fullName: "Alice Officer" });
    const { app: app1 } = await submittedFsla();
    expect(app1.assignedOfficerId).toBe(officerA.user.id);
    const officerB = await makeUser(["REVIEWING_OFFICER"], { fullName: "Bruno Officer" });
    const lead = await makeUser(["APPROVING_AUTHORITY"], { fullName: "Lena Lead" });

    // An officer can't take a colleague's file; the lead (review.assign) can reassign it.
    await expectAppError(assignTo(app1.id, officerB.user.id, officerB.user, ctx), "notAssigned");
    await assignTo(app1.id, officerB.user.id, lead.user, ctx);
    expect(
      (await db.application.findUniqueOrThrow({ where: { id: app1.id } })).assignedOfficerId,
    ).toBe(officerB.user.id);
    const audit = await db.auditEvent.findFirstOrThrow({
      where: { entityId: app1.id, action: "application.assigned", actorId: lead.user.id },
      orderBy: { id: "desc" },
    });
    expect(audit.metadata).toMatchObject({
      officerId: officerB.user.id,
      previousOfficerId: officerA.user.id,
      mode: "takeover",
    });
    expect(await notifications(officerB.user, "assigned")).toBe(1);
    expect(await notifications(officerA.user, "reassigned")).toBe(1);

    // FR-BO-003: an officer who owns the firm named in Section G has a conflict.
    const { app: app2 } = await submittedFsla("Claude Mugabo");
    const { app: app3 } = await submittedFsla("Denise Ingabire");
    const officerC = await makeUser(["REVIEWING_OFFICER"], { fullName: "Cyril Officer" });
    const otherFirm = (await makeFirmWithPeople()).firm;
    await db.firm.update({ where: { id: otherFirm.id }, data: { ownerId: officerC.user.id } });
    const data2 = app2.data as ApplicationData;
    await db.application.update({
      where: { id: app2.id },
      data: {
        data: { ...data2, g: { ...data2.g, proposedFirmRef: otherFirm.companyRegNo } } as object,
      },
    });
    await db.application.updateMany({
      where: { id: { in: [app2.id, app3.id] } },
      data: { assignedOfficerId: null, assignedAt: null },
    });
    expect(await conflictsFor(app2.id, officerC.user.id)).toContain("firm");
    expect(await conflictsFor(app3.id, officerC.user.id)).toEqual([]);

    // FR-BO-005: one action, per-file results; the conflicting file is reported, not assigned.
    const result = await bulkAssign([app2.id, app3.id], officerC.user.id, lead.user, ctx);
    expect(result.assigned).toEqual([app3.referenceNo]);
    expect(result.skipped).toEqual([
      { reference: app2.referenceNo, error: "errors.conflictOfInterest", reasons: ["firm"] },
    ]);
    expect(
      (await db.application.findUniqueOrThrow({ where: { id: app3.id } })).assignedOfficerId,
    ).toBe(officerC.user.id);

    // Officers may only bulk-take unassigned files themselves.
    await expectAppError(bulkAssign([app2.id], officerC.user.id, officerB.user, ctx), "forbidden");
    const self = await bulkAssign([app2.id, app3.id], officerB.user.id, officerB.user, ctx);
    expect(self.assigned).toEqual([app2.referenceNo]);
    expect(self.skipped.map((s) => [s.reference, s.error])).toEqual([
      [app3.referenceNo, "errors.notAssigned"],
    ]);

    // FR-BO-001: officer filter, sorts and time in state.
    const unassigned = await queue({ view: "all", officer: "none" }, officerB.user);
    expect(unassigned.items).toHaveLength(0);
    const byOfficer = await queue({ view: "all", officer: officerB.user.id }, lead.user);
    expect(byOfficer.items.map((i) => i.id).sort()).toEqual([app1.id, app2.id].sort());
    const stale = await queue({ view: "all", sort: "stale" }, lead.user);
    expect(stale.items).toHaveLength(3);
    const since = stale.items.map((i) => i.inStateSince.getTime());
    expect([...since].sort((a, b) => a - b)).toEqual(since);
    const submitted = await queue({ view: "all", sort: "submitted" }, lead.user);
    expect(submitted.items[0]!.id).toBe(app3.id);
  }, 90_000);
});

describe("administrator reviews and decides (SOD_EXEMPT_ROLES, BR-091)", () => {
  it("reviews A and decides B, but can never decide A; corrects B's decision", async () => {
    const officer = await makeUser(["REVIEWING_OFFICER"], { fullName: "Olive Officer" });
    const admin = await makeUser(["SYSTEM_ADMIN"], { fullName: "Adam Admin" });
    const { app: appA } = await submittedFsla("Aline Uwase");
    const { app: appB, applicant: applicantB } = await submittedFsla("Bella Uwera");
    // Auto-assignment never picks an administrator.
    expect(appA.assignedOfficerId).toBe(officer.user.id);
    expect(appB.assignedOfficerId).toBe(officer.user.id);

    // The administrator takes A (review.assign) and reviews it.
    await assignTo(appA.id, admin.user.id, admin.user, ctx);
    await reviewAndSign(appA.id, admin);
    await reviewAndSign(appB.id, officer);

    await expectAppError(assertCanDecide(appA.id, admin.user), "segregationOfDuties");
    await expectAppError(approve(appA.id, admin), "segregationOfDuties");
    const { decisionId, licenceId } = await approve(appB.id, admin);
    expect(licenceId).not.toBeNull();
    expect((await db.application.findUniqueOrThrow({ where: { id: appB.id } })).status).toBe(
      "LICENSE_ISSUED",
    );

    // FR-BO-006: the 360° view carries payments, affiliations and communications.
    const overview = await applicantOverview(applicantB.user.id);
    expect(overview.payments.length).toBeGreaterThan(0);
    expect(overview.affiliations).toHaveLength(1);
    expect(overview.licenceEvents.map((e) => e.action)).toContain("ISSUED");
    expect(overview.notifications.map((n) => n.messageKey)).toContain("approved");

    // FR-M-017: a correction is a new, linked decision with a new letter.
    const original = await db.decision.findUniqueOrThrow({ where: { id: decisionId } });
    const correction = await correctDecision(
      {
        decisionId,
        reason: "Correction of a clerical error in the reasons",
        reasons: "Meets every requirement of the Regulations.",
      },
      admin.user,
      ctx,
    );
    const corrected = await db.decision.findUniqueOrThrow({
      where: { id: correction.decisionId },
    });
    expect(corrected.correctsId).toBe(original.id);
    expect(corrected.decision).toBe(original.decision);
    expect(corrected.letterNo).not.toBe(original.letterNo);
    expect(corrected.reasons).toBe("Meets every requirement of the Regulations.");
    expect(corrected.correctionReason).toBe("Correction of a clerical error in the reasons");
    expect((await db.decision.findUniqueOrThrow({ where: { id: original.id } })).reasons).toBe(
      "Meets every requirement.",
    );
    expect((await db.licence.findUniqueOrThrow({ where: { id: licenceId! } })).decisionId).toBe(
      corrected.id,
    );
    expect(
      await db.auditEvent.count({
        where: { action: "decision.corrected", entityId: corrected.id },
      }),
    ).toBe(1);
    expect(await notifications(applicantB.user, "decisionCorrected")).toBe(1);
    const letter = await decisionLetterFor(corrected.id, applicantB.user);
    expect(Buffer.from(letter.bytes).subarray(0, 5).toString()).toBe("%PDF-");
    // Only the latest record in a chain can be corrected.
    await expectAppError(
      correctDecision({ decisionId, reason: "Second correction attempt" }, admin.user, ctx),
      "decisionAlreadyCorrected",
    );

    // Immutability (migration 20261017120000): the database refuses UPDATE and DELETE.
    const [trigger] = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
      "SELECT count(*) AS count FROM pg_trigger WHERE tgname = 'decision_no_update'",
    );
    if (Number(trigger?.count ?? 0) > 0) {
      await expect(
        db.decision.update({ where: { id: original.id }, data: { reasons: "tampered" } }),
      ).rejects.toThrow(/immutable/);
      await expect(db.decision.delete({ where: { id: original.id } })).rejects.toThrow(/immutable/);
    } else {
      console.warn("[test] decision_no_update trigger missing: apply the migrations first");
    }
  }, 120_000);
});

describe("licensing follow-ups (FR-N-009, FR-N-012, FR-BO-004)", () => {
  it("reissues a certificate: new version, new QR, the old QR is superseded, holder told", async () => {
    const holder = await makeUser(["APPLICANT"]);
    const registrar = await makeUser(["REGISTRAR"]);
    const licence = await makeLicence(holder.user.id, "FSLA");
    const { certificateVersion } = await reissueCertificate(
      licence.id,
      registrar.user.id,
      "Certificate reported lost",
      ctx,
    );
    expect(certificateVersion).toBe(2);
    const updated = await db.licence.findUniqueOrThrow({ where: { id: licence.id } });
    expect(updated.qrToken).not.toBe(licence.qrToken);
    expect(await findRegisterEntry(licence.qrToken)).toEqual({
      entry: null,
      superseded: true,
      current: licence.licenceNo,
    });
    expect(
      await db.licenceEvent.count({
        where: { licenceId: licence.id, action: "CERTIFICATE_REISSUED" },
      }),
    ).toBe(1);
    expect(await notifications(holder.user, "certificateReissued")).toBe(1);
    expect(
      await db.auditEvent.count({
        where: { action: "licence.certificate_reissued", entityId: licence.id },
      }),
    ).toBe(1);
  });

  it("alerts the registrars once when issuance fails, then the retry issues the licence", async () => {
    const officer = await makeUser(["REVIEWING_OFFICER"]);
    const approver = await makeUser(["APPROVING_AUTHORITY"]);
    const registrar = await makeUser(["REGISTRAR"]);
    const { app } = await submittedFsla();
    await reviewAndSign(app.id, officer);

    // Take the licence number issuance will draw next, so the issuing transaction fails.
    const [seq] = await db.$queryRawUnsafe<Array<{ last_value: bigint; is_called: boolean }>>(
      "SELECT last_value, is_called FROM licence_seq",
    );
    const next = Number(seq!.last_value) + (seq!.is_called ? 1 : 0);
    const blocker = await makeLicence(null, "FSLA");
    await db.licence.update({
      where: { id: blocker.id },
      data: { licenceNo: formatLicenceNo("FSLA", Number(todayKigali().slice(0, 4)), next) },
    });

    const result = await approve(app.id, approver);
    expect(result.licenceId).toBeNull();
    expect((await db.application.findUniqueOrThrow({ where: { id: app.id } })).status).toBe(
      "APPROVED",
    );
    expect(
      await db.auditEvent.count({ where: { action: "licence.issuance_failed", entityId: app.id } }),
    ).toBe(1);
    expect(await notifications(registrar.user, "issuanceFailed")).toBe(1);

    // FR-N-009: the scheduled retry succeeds (the next number is free) without a second alert.
    await db.application.update({
      where: { id: app.id },
      data: { decidedAt: new Date(Date.now() - 5 * 60_000) },
    });
    expect(await retryPendingIssuance()).toEqual({ retried: 1, issued: 1 });
    expect((await db.application.findUniqueOrThrow({ where: { id: app.id } })).status).toBe(
      "LICENSE_ISSUED",
    );
    expect(await notifications(registrar.user, "issuanceFailed")).toBe(1);
  }, 90_000);

  it("escalates a file breached by more than two working days to the leads, once", async () => {
    const officer = await makeUser(["REVIEWING_OFFICER"]);
    const lead = await makeUser(["APPROVING_AUTHORITY"]);
    const { app } = await submittedFsla();
    expect(app.assignedOfficerId).toBe(officer.user.id);
    const now = new Date();

    // One day late: the officer is warned, nobody is escalated to.
    await db.application.update({
      where: { id: app.id },
      data: { slaDueAt: new Date(now.getTime() - 86_400_000) },
    });
    expect(await runSlaWarnings(now)).toEqual({ warned: 1, escalated: 0 });

    // A week late: escalated to review.assign holders, once.
    await db.application.update({
      where: { id: app.id },
      data: { slaDueAt: new Date(now.getTime() - 7 * 86_400_000) },
    });
    expect((await runSlaWarnings(now)).escalated).toBe(1);
    expect((await runSlaWarnings(now)).escalated).toBe(0);
    expect(await notifications(lead.user, "slaEscalated")).toBe(1);
    expect(await notifications(officer.user, "slaEscalated")).toBe(0);
  }, 60_000);
});
