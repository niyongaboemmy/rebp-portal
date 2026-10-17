import { z } from "zod";
import type { ApplicationType, Category } from "./categories";
import { sectionsFor } from "./application";
import {
  checkSection,
  sectionCSchema,
  sectionDSchema,
  sectionESchema,
  type ApplicationData,
  type Issues,
  type SectionC,
} from "./sections";

/**
 * The applicant's CV (UX-018): the credentials that belong to the person, not to one
 * application — education (C), training and exams (D) and professional experience (E). Kept on
 * the account, edited once on the profile or in any application, and copied into every open
 * application. What an application decides for itself stays there: which qualification it relies
 * on for its category.
 */
export const CV_SECTIONS = ["c", "d", "e"] as const;
export type CvSection = (typeof CV_SECTIONS)[number];

export const cvSchema = z
  .object({ c: sectionCSchema, d: sectionDSchema, e: sectionESchema })
  .partial();
export type Cv = z.infer<typeof cvSchema>;

export const isCvSection = (key: string): key is CvSection =>
  (CV_SECTIONS as readonly string[]).includes(key);

/** The CV copy of a section: without the application's own choices. */
export function toCv<K extends CvSection>(key: K, data: Cv[K]): Cv[K] {
  if (key !== "c" || !data) return data;
  const c = data as SectionC;
  return {
    ...c,
    qualifications: c.qualifications?.map(({ reliedUpon: _relied, ...q }) => q),
  } as Cv[K];
}

/**
 * An application's copy of a CV section, keeping what that application chose: the qualifications
 * it relies on (the first one when it hasn't chosen yet).
 */
export function fromCv<K extends CvSection>(key: K, cv: Cv[K], current?: ApplicationData[K]) {
  if (key !== "c" || !cv) return cv as ApplicationData[K];
  const list = (cv as SectionC).qualifications ?? [];
  const before = (current as SectionC | undefined)?.qualifications ?? [];
  let qualifications = list.map((q) => ({
    ...q,
    reliedUpon: before.find((b) => b.id === q.id)?.reliedUpon,
  }));
  if (qualifications.length > 0 && !qualifications.some((q) => q.reliedUpon))
    qualifications = qualifications.map((q, i) => ({ ...q, reliedUpon: i === 0 }));
  return { ...(cv as SectionC), qualifications } as ApplicationData[K];
}

/** What only an application asks (its relied-upon qualification, at least one period). */
const APPLICATION_ONLY: Record<CvSection, ReadonlySet<string>> = {
  c: new Set(["qualifications"]),
  d: new Set(),
  e: new Set(["records"]),
};

/** The CV's open answers per section: the application checks, less what only an application decides. */
export function checkCv(cv: Cv, today: string): Record<CvSection, Issues> {
  const ctx = { type: "NEW" as const, category: "RERA" as const, today };
  const data = cv as ApplicationData;
  return Object.fromEntries(
    CV_SECTIONS.map((key) => {
      const issues = checkSection(key, data, ctx);
      return [
        key,
        Object.fromEntries(
          Object.entries(issues).filter(([path]) => !APPLICATION_ONLY[key].has(path)),
        ),
      ];
    }),
  ) as Record<CvSection, Issues>;
}

export interface CvCompletion {
  /** Open answers per section. */
  missing: Record<CvSection, number>;
  /** Sections with something entered and nothing open. */
  done: number;
  total: number;
  percent: number;
  complete: boolean;
}

/**
 * Whether a CV part holds what an application needs from it: at least one qualification; the
 * training and exam questions answered; at least one period of practice, or a recognised
 * equivalence.
 */
function hasContent(cv: Cv): Record<CvSection, boolean> {
  return {
    c: Boolean(cv.c?.qualifications?.length),
    d: cv.d?.trainingCompleted !== undefined && cv.d?.examPassed !== undefined,
    e: Boolean(cv.e?.records?.length || cv.e?.equivalentRecognised),
  };
}

/** A CV part is ready once it has that content and no open answers. */
export function cvSectionReady(cv: Cv, key: CvSection, today: string): boolean {
  return hasContent(cv)[key] && Object.keys(checkCv(cv, today)[key]).length === 0;
}

/**
 * The CV parts a new application of this type and category needs and the CV doesn't have yet
 * (UX-021): qualifications are part of the applicant, so they come before applying.
 */
export function cvMissingFor(
  cv: Cv,
  type: ApplicationType,
  category: Category,
  today: string,
): CvSection[] {
  if (type !== "NEW" || category === "REBF") return [];
  return sectionsFor(type, category)
    .filter(isCvSection)
    .filter((key) => !cvSectionReady(cv, key, today));
}

/** How far the CV is: a section counts once it has content and no open answers. */
export function cvCompletion(cv: Cv, today: string): CvCompletion {
  const issues = checkCv(cv, today);
  const has = hasContent(cv);
  const missing = Object.fromEntries(
    CV_SECTIONS.map((key) => [key, Object.keys(issues[key]).length]),
  ) as Record<CvSection, number>;
  const done = CV_SECTIONS.filter((key) => has[key] && missing[key] === 0).length;
  return {
    missing,
    done,
    total: CV_SECTIONS.length,
    percent: Math.round((done / CV_SECTIONS.length) * 100),
    complete: done === CV_SECTIONS.length,
  };
}
