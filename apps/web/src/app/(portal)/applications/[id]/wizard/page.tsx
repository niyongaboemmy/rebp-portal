import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { stepsFor, type Address, type StepKey } from "@rebp/contracts";
import { Wizard } from "@/components/wizard/wizard";
import type { WizardDocument, WizardInit } from "@/components/wizard/context";
import { ApplicationHeader } from "@/components/applications/application-header";
import { BreadcrumbTail } from "@/components/layout/breadcrumbs";
import { syncProfileDocuments } from "@/server/profile/documents";
import { withProfile } from "@/server/profile/profile";
import { withCv } from "@/server/profile/cv";
import {
  applicationForOwner,
  isEditable,
  sectionContext,
} from "@/server/applications/applications";
import { runEligibility } from "@/server/applications/facts";
import { requireCapability } from "@/server/auth/guards";
import { db } from "@/server/db";
import { firmSummary } from "@/server/firms/firms";
import { feeQuote } from "@/server/payments/payments";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("wizard"))("metaTitle") };
}

/** Collects every administrative-division code in the data, for display names in the summary. */
function divisionCodes(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => divisionCodes(v, into));
  else if (value && typeof value === "object") {
    const address = value as Address;
    for (const key of ["province", "district", "sector", "cell", "village"] as const)
      if (address[key]) into.add(address[key]!);
    Object.values(value).forEach((v) => typeof v === "object" && divisionCodes(v, into));
  }
  return into;
}

/** The guided application (FR-WIZ-001…014). Editable in DRAFT and ACTION_REQUIRED (FR-WF-002). */
export default async function WizardPage({
  params,
  searchParams,
}: PageProps<"/applications/[id]/wizard">) {
  const { user } = await requireCapability("application.edit");
  const { id } = await params;
  const query = await searchParams;
  let app = await applicationForOwner(id, user);
  if (!app) notFound();
  if (!isEditable(app)) redirect(`/applications/${app.id}`);

  // Section B is the applicant's profile (UX-010): an open application picks up its latest version.
  // Personal details from the profile, education/training/experience from the CV (UX-010/018).
  const data = await withCv(app, user, await withProfile(app, user));
  // ...and its identity documents (copies of the profile's), shown in the reloaded application.
  if (await syncProfileDocuments(app, user)) app = (await applicationForOwner(id, user)) ?? app;
  const [locale, t, tc, ctx, eligibility, provinces, fee, firm] = await Promise.all([
    getLocale(),
    getTranslations("wizard"),
    getTranslations("categories.items"),
    sectionContext(app),
    runEligibility(app, data),
    db.adminDivision.findMany({
      where: { level: 1 },
      orderBy: { code: "asc" },
      select: { code: true, name: true, level: true },
    }),
    feeQuote(app),
    data.f?.firmId ? firmSummary(data.f.firmId) : Promise.resolve(null),
  ]);
  const codes = [...divisionCodes(data), ...(data.g?.territory ?? [])];
  const divisions = codes.length
    ? await db.adminDivision.findMany({
        where: { code: { in: codes } },
        select: { code: true, name: true },
      })
    : [];

  const steps = stepsFor(app.type, app.category);
  const requested = (typeof query.step === "string" ? query.step : undefined) as
    StepKey | undefined;
  const firstUnlocked =
    app.status === "ACTION_REQUIRED"
      ? (steps.find((s) => app.unlockedSections.includes(s)) ?? "i")
      : undefined;
  const initialStep: StepKey =
    requested && steps.includes(requested)
      ? requested
      : ((firstUnlocked as StepKey | undefined) ??
        (steps.includes(app.lastStep as StepKey) ? (app.lastStep as StepKey) : "a"));
  const openRequest = app.infoRequests.find((r) => r.status === "OPEN");

  const init: WizardInit = {
    application: {
      id: app.id,
      referenceNo: app.referenceNo,
      type: app.type,
      category: app.category,
      status: app.status,
      unlockedSections: app.unlockedSections,
      unlockedDocuments: app.unlockedDocuments,
      extraDocuments: app.extraDocuments,
      infoRequest: openRequest
        ? { message: openRequest.message, dueAt: openRequest.dueAt.toISOString() }
        : null,
      accountType: user.accountType,
    },
    steps,
    initialStep,
    data,
    documents: app.documents.map((d): WizardDocument => ({
      id: d.id,
      type: d.type as WizardDocument["type"],
      status: d.status,
      fileName: d.versions[0]?.fileName ?? "",
      size: d.versions[0]?.size ?? 0,
      mimeType: d.versions[0]?.mimeType ?? "",
      version: d.currentVersion,
      officerNote: d.officerNote,
    })),
    context: { today: ctx.today, flags: ctx.flags },
    eligibility: {
      outcome: eligibility.outcome,
      rules: eligibility.rules,
      experience: eligibility.experience ?? null,
    },
    provinces,
    firm,
    fee: { lines: fee.lines, total: fee.total, currency: fee.currency, sample: fee.sample },
    locale,
    phone: user.phone,
    email: user.email,
    signatoryName: user.fullName,
    divisionNames: Object.fromEntries(divisions.map((d) => [d.code, d.name])),
  };

  const tb = await getTranslations("applications.detail");
  return (
    <>
      {/* A one-line header, so the form starts high on every step (UX-006). The reference
          is also the last breadcrumb in the top bar. */}
      <BreadcrumbTail label={app.referenceNo} />
      <ApplicationHeader
        back={{ href: "/applications", label: tb("back") }}
        title={tc(`${app.category}.name`)}
        typeLine={t(`typeLine.${app.type}`)}
        reference={app.referenceNo}
      />
      <Wizard init={init} />
    </>
  );
}
