import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import {
  APPLICATION_TYPES,
  calculateFees,
  CV_SECTIONS,
  cvSectionReady,
  type CvSection,
  CATEGORIES,
  categoryAvailability,
  PILOT_APPLICATION_TYPES,
  type ApplicationType,
  type Category,
} from "@rebp/contracts";
import { NewApplication, type AvailabilityMap } from "@/components/applications/new-application";
import { PageHeader } from "@/components/ui/page-header";
import { heldLicenceSummaries } from "@/server/applications/facts";
import { requireCapability } from "@/server/auth/guards";
import { getConfig } from "@/server/config/config";
import { db } from "@/server/db";
import { cvOf } from "@/server/profile/cv";
import { needsProfile } from "@/server/profile/profile";
import { todayKigali } from "@/server/time";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("applications.new"))("title") };
}

/**
 * Section A (FR-A-003…007, FR-DOM-001, FR-WIZ-002): pick the application type, then a category.
 * Unavailable options stay visible with the reason, e.g. "Renewal is available once you hold an
 * active licence". Cards show key requirements and the indicative fee.
 */
export default async function NewApplicationPage({ searchParams }: PageProps<"/applications/new">) {
  const { user } = await requireCapability("application.edit");
  const query = await searchParams;
  const [t, locale, licences, fees, cv] = await Promise.all([
    getTranslations("applications.new"),
    getLocale(),
    heldLicenceSummaries(user.id),
    getConfig("fees"),
    needsProfile(user) ? cvOf(user) : null,
  ]);
  // Which CV parts are ready (UX-021): a category needing a missing part sends the applicant to
  // their CV first.
  const today = todayKigali();
  const cvReady = cv
    ? (Object.fromEntries(
        CV_SECTIONS.map((key) => [key, cvSectionReady(cv, key, today)]),
      ) as Record<CvSection, boolean>)
    : null;
  const ctx = { applicantType: user.accountType, licences };

  const availability = Object.fromEntries(
    APPLICATION_TYPES.map((type) => [
      type,
      Object.fromEntries(
        CATEGORIES.map((category) => {
          const result = categoryAvailability(type, category, ctx);
          return [category, result.ok ? null : result.reason];
        }),
      ),
    ]),
  ) as AvailabilityMap;
  const fee = Object.fromEntries(
    CATEGORIES.map((c) => [c, calculateFees(fees.value, { category: c, type: "NEW" }).total]),
  ) as Record<Category, number>;
  const held = await db.licence.findMany({
    where: { holderId: user.id, status: { in: ["ACTIVE", "EXPIRED"] } },
    select: { id: true, licenceNo: true, category: true, status: true, expiresAt: true },
    orderBy: { expiresAt: "asc" },
  });
  const renewable = new Set(licences.filter((l) => l.renewable).map((l) => l.id));

  const type = (
    typeof query.type === "string" && (APPLICATION_TYPES as readonly string[]).includes(query.type)
      ? query.type
      : undefined
  ) as ApplicationType | undefined;
  const category = (
    typeof query.category === "string" && (CATEGORIES as readonly string[]).includes(query.category)
      ? query.category
      : undefined
  ) as Category | undefined;

  return (
    <>
      {/* Each survey screen asks its own question; the header stays one line (UX-006). */}
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} />
      <NewApplication
        availability={availability}
        pilotTypes={[...PILOT_APPLICATION_TYPES]}
        fees={fee}
        schedule={fees.value}
        sampleFees={fees.value.sample}
        accountType={user.accountType}
        locale={locale}
        licences={held.map((l) => ({
          id: l.id,
          licenceNo: l.licenceNo,
          category: l.category,
          status: l.status,
          expiresAt: l.expiresAt.toISOString(),
          renewable: renewable.has(l.id),
        }))}
        initialType={type}
        initialCategory={category}
        initialLicence={typeof query.licence === "string" ? query.licence : undefined}
        cvReady={cvReady}
      />
    </>
  );
}
