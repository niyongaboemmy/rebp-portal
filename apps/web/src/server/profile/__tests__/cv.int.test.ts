import { describe, expect, it } from "vitest";
import { createApplication, saveSection } from "@/server/applications/applications";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { makeUser } from "@/test/fixtures";
import { cvOf, saveCvSection } from "../cv";

/** UX-018: education, training and experience live on the applicant's CV. */
const ctx = { ipAddress: "127.0.0.1", userAgent: "vitest" };
const dataOf = async (id: string) =>
  ((await db.application.findUniqueOrThrow({ where: { id } })).data ?? {}) as Record<
    string,
    { qualifications?: Array<{ id: string; reliedUpon?: boolean }>; records?: unknown[] }
  >;

describe("applicant CV", () => {
  it("is saved from an application and kept in step with the applicant's drafts", async () => {
    const { user } = await makeUser(["APPLICANT"]);
    const app = await createApplication(user, { type: "NEW", category: "FSLA" }, ctx);

    // Entered in the application: saved to the CV, the application keeps its relied-upon choice.
    await saveSection(
      app.id,
      {
        section: "c",
        data: {
          highestLevel: "A2",
          qualifications: [
            { id: "q1", qualification: "A2 certificate", reliedUpon: true },
            { id: "q2", qualification: "Diploma", reliedUpon: false },
          ],
        },
      },
      user,
      ctx,
    );
    const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    const cv = await cvOf(fresh);
    expect(cv.c?.qualifications).toHaveLength(2);
    expect(cv.c?.qualifications?.[0]).not.toHaveProperty("reliedUpon");

    // Edited on the CV: the draft follows, and still relies on what it chose.
    await saveCvSection(
      fresh,
      "c",
      {
        highestLevel: "A2",
        qualifications: [
          { id: "q1", qualification: "A2 certificate (Science)" },
          { id: "q2", qualification: "Diploma" },
        ],
      },
      ctx,
    );
    const after = await dataOf(app.id);
    expect(after.c?.qualifications?.map((q) => q.reliedUpon)).toEqual([true, false]);
    expect(JSON.stringify(after.c)).toContain("A2 certificate (Science)");
  });

  it("fills a new application from the CV", async () => {
    const { user } = await makeUser(["APPLICANT"]);
    await saveCvSection(
      user,
      "e",
      {
        records: [
          { id: "r1", firm: "Keza Realty", category: "FSLA", from: "2022-01-01", current: true },
        ],
        equivalentRecognised: false,
      },
      ctx,
    );
    const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    const app = await createApplication(fresh, { type: "NEW", category: "FSLA" }, ctx);
    expect((await dataOf(app.id)).e?.records).toHaveLength(1);
  });

  it("starts from the latest application for applicants who had none", async () => {
    const { user } = await makeUser(["APPLICANT"]);
    const app = await createApplication(user, { type: "NEW", category: "FSLA" }, ctx);
    // An applicant from before the CV: answers only in an application.
    await db.application.update({
      where: { id: app.id },
      data: { data: { d: { trainingCompleted: false, examPassed: "NO" } } },
    });
    const before = await db.user.update({ where: { id: user.id }, data: { cv: Prisma.DbNull } });
    expect((await cvOf(before)).d).toEqual({ trainingCompleted: false, examPassed: "NO" });
  });

  it("is needed before applying (UX-021)", async () => {
    const { user } = await makeUser(["APPLICANT"], { cv: false });
    await expect(
      createApplication(user, { type: "NEW", category: "REA" }, ctx),
    ).rejects.toMatchObject({ message: "errors.cvIncomplete", meta: { parts: "c,d,e" } });
  });
});
