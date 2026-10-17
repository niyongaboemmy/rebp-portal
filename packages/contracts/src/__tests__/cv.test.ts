import { describe, expect, it } from "vitest";
import { checkCv, cvCompletion, cvMissingFor, fromCv, toCv } from "../cv";

/** UX-018: the CV keeps the person's credentials; each application keeps its own choices. */
const today = "2026-10-16";

describe("applicant CV", () => {
  it("leaves the relied-upon choice to each application", () => {
    const c = {
      highestLevel: "A2" as const,
      qualifications: [
        { id: "q1", qualification: "A2", reliedUpon: false },
        { id: "q2", qualification: "Degree", reliedUpon: true },
      ],
    };
    const cv = toCv("c", c);
    expect(cv?.qualifications?.every((q) => !("reliedUpon" in q))).toBe(true);

    // An application keeps what it chose…
    expect(fromCv("c", cv, c)?.qualifications?.map((q) => q.reliedUpon)).toEqual([false, true]);
    // …and a new one relies on the first qualification until the applicant chooses.
    expect(fromCv("c", cv, undefined)?.qualifications?.map((q) => q.reliedUpon)).toEqual([
      true,
      false,
    ]);
  });

  it("asks what the CV needs, not what only an application decides", () => {
    const issues = checkCv({ c: { highestLevel: "A2", qualifications: [] } }, today);
    expect(issues.c.qualifications).toBeUndefined();
    expect(issues.e.records).toBeUndefined();
    expect(issues.d.trainingCompleted).toBe("validation.required");
  });

  it("counts a section once it has content and nothing open", () => {
    expect(cvCompletion({}, today)).toMatchObject({ done: 0, percent: 0, complete: false });
    const done = cvCompletion(
      {
        d: { trainingCompleted: false, examPassed: "NO" },
      },
      today,
    );
    expect(done.missing.d).toBe(0);
    expect(done.done).toBe(1);
  });

  it("is needed before applying, part by part for the category", () => {
    const c = {
      highestLevel: "A2" as const,
      qualifications: [
        {
          id: "q1",
          institution: "GS Kimironko",
          qualification: "A2",
          fieldOfStudy: "GENERAL_SECONDARY" as const,
          yearCompleted: 2016,
          isForeign: false,
        },
      ],
    };
    expect(cvMissingFor({}, "NEW", "RERA", today)).toEqual(["c"]);
    expect(cvMissingFor({ c }, "NEW", "RERA", today)).toEqual([]);
    expect(cvMissingFor({ c }, "NEW", "REA", today)).toEqual(["d", "e"]);
    // Renewals and firms don't ask for a CV.
    expect(cvMissingFor({}, "RENEWAL", "REA", today)).toEqual([]);
    expect(cvMissingFor({}, "NEW", "REBF", today)).toEqual([]);
  });
});
