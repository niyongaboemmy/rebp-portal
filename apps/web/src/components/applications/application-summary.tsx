"use client";

import { Check, ChevronDown, PenLine } from "@/components/icons";
import type { Route } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  sectionsFor,
  type ApplicationData,
  type ApplicationType,
  type Category,
  type SectionKey,
} from "@rebp/contracts";
import { formatDay, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Read-only view of form REBP–REG–01 sections B–H (SRS Appendix A). Used by the officer's review
 * console (FR-L-002), the approver's decision screen (FR-M-001) and the applicant's final check
 * before signing (FR-WIZ-012). Server-compatible: no state and no effects; field labels come from
 * the "summary" namespace. Only fields with a value are listed; `false` answers are shown ("No").
 */

type Kind =
  | "text"
  | "date"
  | "bool"
  | "number"
  /** A calendar year: no thousands separator ("2016", not "2,016"). */
  | "year"
  | "money"
  | "percent"
  | "address"
  | "divisions"
  | "country"
  | "countries"
  | "category"
  | { enum: string }
  | { enumList: string };

type FieldSpec = readonly [path: string, kind?: Kind];
interface ListSpec {
  list: string;
  /** Field shown in the item heading. */
  title: string;
  fields: readonly FieldSpec[];
}
type Spec = FieldSpec | ListSpec;

const E = (name: string) => ({ enum: `summary.enums.${name}` });

const SPECS: Record<SectionKey, readonly Spec[]> = {
  b: [
    ["surname"],
    ["givenNames"],
    ["otherNames"],
    ["fullNameOnId"],
    ["idType", E("idTypes")],
    ["idNumber"],
    ["idCountry", "country"],
    ["idExpiry", "date"],
    ["dateOfBirth", "date"],
    ["nationality", "countries"],
    ["gender", E("genders")],
    ["phone"],
    ["email"],
    ["residentialAddress", "address"],
    ["professionalSameAsResidential", "bool"],
    ["professionalAddress", "address"],
    ["occupation"],
    ["employer"],
  ],
  c: [
    ["highestLevel", E("educationLevels")],
    {
      list: "qualifications",
      title: "qualification",
      fields: [
        ["institution"],
        ["fieldOfStudy", E("fieldsOfStudy")],
        ["fieldOther"],
        ["yearCompleted", "year"],
        ["certificateNo"],
        ["isForeign", "bool"],
        ["reliedUpon", "bool"],
      ],
    },
  ],
  d: [
    ["trainingCompleted", "bool"],
    ["trainingProvider", E("trainingProviders")],
    ["trainingProviderOther"],
    ["trainingProgramme", E("trainingProgrammes")],
    ["trainingCompletedOn", "date"],
    ["trainingCertificateNo"],
    ["examPassed", E("examAnswers")],
    ["examReference"],
    ["examDate", "date"],
  ],
  e: [
    ["currentCategory", "category"],
    ["previousLicenceNo"],
    ["declaredYears", "number"],
    ["priorCategoryForExperience", E("experienceCategories")],
    ["initialRegistrationDate", "date"],
    ["equivalentRecognised", "bool"],
    ["equivalenceReference"],
    {
      list: "records",
      title: "firm",
      fields: [
        ["category", E("experienceCategories")],
        ["from", "date"],
        ["to", "date"],
        ["current", "bool"],
        ["duties"],
      ],
    },
    ["refereeName"],
    ["refereeRole"],
    ["refereePhone"],
    ["refereeEmail"],
  ],
  f: [
    ["practiceArrangement", { enum: "arrangements" }],
    ["reraMode", E("reraModes")],
    ["isAffiliated", "bool"],
    ["firmName"],
    ["supervisorLicenceNo"],
    ["affiliationStart", "date"],
    ["referralArrangementName"],
    ["referralApprovalRef"],
    ["independentAuthorisationRef"],
    ["independentNotes"],
  ],
  g: [
    ["dataConfirmed", "bool"],
    ["article10Ack", "bool"],
    ["territory", "divisions"],
    ["restrictionsAck", "bool"],
    ["brokerLicenceNo"],
    ["supervisionAck", "bool"],
    ["proposedBranchName"],
    ["supervisedCount", "number"],
    ["supervisoryFunctions", { enumList: "summary.enums.supervisoryFunctions" }],
    ["supervisoryNotes"],
    ["proposedFirmRef"],
    ["indemnity.insurer"],
    ["indemnity.policyNo"],
    ["indemnity.cover", "money"],
    ["indemnity.from", "date"],
    ["indemnity.to", "date"],
    ["responsibilities", { enumList: "summary.enums.responsibilities" }],
    // G8 — the firm (FR-G8-001…013)
    ["legalName"],
    ["tradingName"],
    ["legalForm", E("legalForms")],
    ["companyRegNo"],
    ["tin"],
    ["incorporatedOn", "date"],
    ["registeredOffice", "address"],
    ["placeSameAsOffice", "bool"],
    ["principalPlace", "address"],
    ["phone"],
    ["email"],
    ["principalBrokerLicenceNo"],
    {
      list: "responsiblePersons",
      title: "name",
      fields: [
        ["role"],
        ["idType", E("idTypes")],
        ["idNumber"],
        ["nationality", "country"],
        ["phone"],
        ["email"],
        ["shareholding", "percent"],
      ],
    },
    {
      list: "branches",
      title: "name",
      fields: [
        ["address", "address"],
        ["phone"],
        ["managingBrokerLicenceNo"],
        ["openingDate", "date"],
      ],
    },
    ["clientFundsApplicable", "bool"],
    ["hasSupervisoryManual", "bool"],
  ],
  h: [
    ["criminalConviction", "bool"],
    ["disciplinarySanction", "bool"],
    ["licenceRevoked", "bool"],
    ["currentRestriction", "bool"],
    {
      list: "disclosures",
      title: "question",
      fields: [["nature"], ["date", "date"], ["authority"], ["outcome"], ["currentStatus"]],
    },
    ["criminalRecordIssuedOn", "date"],
    ["codeOfConduct", "bool"],
  ],
};

const get = (source: unknown, path: string): unknown =>
  path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined,
      source,
    );

const isEmpty = (value: unknown) =>
  value === undefined ||
  value === null ||
  value === "" ||
  (Array.isArray(value) && value.length === 0);

/** "indemnity.cover" → "indemnityCover" (one flat label namespace per section). */
const labelKey = (path: string) => path.replace(/\.(\w)/g, (_, c: string) => c.toUpperCase());

interface ApplicationSummaryProps {
  type: ApplicationType;
  category: Category;
  data: ApplicationData;
  locale?: string;
  /** Applicant wizard: link each section back to its step. */
  editHref?: (step: SectionKey) => string;
  /** Applicant review: each section folds to one row (title, count, a preview) and opens on tap. */
  collapsible?: boolean;
  /** Administrative-division names by code (addresses, territory). Codes are shown otherwise. */
  divisions?: Record<string, string>;
  /** Override the sections shown (defaults to the sections that apply to type × category). */
  sections?: readonly SectionKey[];
  /** Heading level for section titles (2 when the summary sits under the page h1). */
  headingLevel?: 2 | 3;
  className?: string;
}

export function ApplicationSummary({
  type,
  category,
  data,
  locale = "en",
  editHref,
  divisions = {},
  sections,
  headingLevel = 3,
  collapsible = false,
  className,
}: ApplicationSummaryProps) {
  const t = useTranslations();
  const keys = sections ?? sectionsFor(type, category);
  const [open, setOpen] = useState<Set<SectionKey>>(new Set());
  const toggle = (key: SectionKey) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const SubHeading = headingLevel === 2 ? "h3" : "h4";

  const regions = (() => {
    try {
      return new Intl.DisplayNames([locale === "rw" ? "en" : locale], { type: "region" });
    } catch {
      return null;
    }
  })();
  const country = (code: string) => regions?.of(code.toUpperCase()) ?? code;
  const division = (code: string) => divisions[code] ?? code;
  const yesNo = (value: boolean) => (value ? t("summary.yes") : t("summary.no"));
  const enumLabel = (prefix: string, value: string) => {
    const key = `${prefix}.${value}`;
    return t.has(key) ? t(key) : value;
  };

  const address = (value: Record<string, unknown>) => {
    if (value.abroad) return [t("summary.abroad"), value.abroadText].filter(Boolean).join(" — ");
    const parts = ["village", "cell", "sector", "district", "province"]
      .map((k) => value[k])
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .map(division);
    const details = typeof value.details === "string" && value.details ? [value.details] : [];
    return [...details, ...parts].join(", ");
  };

  const render = (value: unknown, kind: Kind = "text"): React.ReactNode => {
    if (typeof kind === "object") {
      if ("enum" in kind) return enumLabel(kind.enum, String(value));
      return (value as string[]).map((v) => enumLabel(kind.enumList, v)).join(" · ");
    }
    switch (kind) {
      case "date":
        return formatDay(String(value), locale);
      case "bool":
        return yesNo(Boolean(value));
      case "number":
        return new Intl.NumberFormat(locale === "rw" ? "en" : locale).format(Number(value));
      case "year":
        return String(value);
      case "money":
        return formatMoney(Number(value), "RWF", locale);
      case "percent":
        return `${Number(value)} %`;
      case "address":
        return address(value as Record<string, unknown>) || t("summary.notProvided");
      case "divisions":
        return (value as string[]).map(division).join(", ");
      case "country":
        return country(String(value));
      case "countries":
        return (value as string[]).map(country).join(", ");
      case "category":
        return t(`categories.items.${String(value)}.name`);
      default:
        return String(value);
    }
  };

  const rows = (section: SectionKey, source: unknown, specs: readonly FieldSpec[]) =>
    specs
      .map(([path, kind]) => ({ path, kind, value: get(source, path) }))
      .filter((row) => !isEmpty(row.value))
      .map((row) => (
        <div key={row.path} className="flex flex-col gap-0.5 sm:contents">
          <dt className="text-xs font-medium text-muted-foreground sm:pt-0.5 sm:text-sm">
            {t(`summary.fields.${section}.${labelKey(row.path)}`)}
          </dt>
          <dd className="text-sm font-medium break-words whitespace-pre-line">
            {render(row.value, row.kind)}
          </dd>
        </div>
      ));

  return (
    <div
      className={cn(
        // Collapsible: one list group (UX-026) — a single panel, rows divided by hairlines.
        collapsible
          ? "flex flex-col divide-y divide-foreground/[0.06] overflow-hidden rounded-2xl bg-card shadow-[0_1px_2px_oklch(0.3_0.08_264/0.05),0_14px_36px_-26px_oklch(0.35_0.15_264/0.45)] ring-1 ring-foreground/[0.06] dark:divide-white/[0.06] dark:bg-surface-2/70 dark:shadow-none dark:ring-white/[0.06]"
          : "flex flex-col gap-4",
        className,
      )}
      data-testid="application-summary"
    >
      {keys.map((section) => {
        const source = data[section] ?? {};
        const specs = SPECS[section];
        const plain = rows(
          section,
          source,
          specs.filter((s): s is FieldSpec => Array.isArray(s)),
        );
        const lists = specs.filter((s): s is ListSpec => !Array.isArray(s));
        const listItems = lists.map((spec) => ({
          spec,
          items: (get(source, spec.list) as Array<Record<string, unknown>> | undefined) ?? [],
        }));
        const empty = plain.length === 0 && listItems.every((l) => l.items.length === 0);
        const title =
          section === "g" ? t(`summary.gTitles.${category}`) : t(`summary.sections.${section}`);
        const answerCount = plain.length + listItems.reduce((n, l) => n + l.items.length, 0);
        const isOpen = !collapsible || open.has(section);
        return (
          <section
            key={section}
            aria-labelledby={`summary-${section}`}
            className={cn(
              "group/sum flex flex-col gap-3",
              collapsible
                ? cn(
                    "transition-colors duration-(--dur-2)",
                    isOpen && "bg-primary/[0.025] pb-4 sm:pb-5 dark:bg-white/[0.02]",
                  )
                : "rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.06] sm:p-5 dark:bg-surface-2/70 dark:ring-white/[0.06]",
            )}
          >
            <div
              className={cn(
                "flex items-center justify-between gap-2",
                collapsible && "px-2 py-1.5 sm:px-3",
              )}
            >
              {collapsible ? (
                <button
                  type="button"
                  onClick={() => toggle(section)}
                  aria-expanded={isOpen}
                  aria-controls={`summary-body-${section}`}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors outline-none hover:bg-primary/[0.04] focus-visible:ring-[3px] focus-visible:ring-ring/40 dark:hover:bg-white/[0.04]"
                >
                  <Heading
                    id={`summary-${section}`}
                    className="flex items-center gap-2.5 text-base font-semibold"
                  >
                    <span
                      aria-hidden
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-xs font-bold text-primary-soft-foreground"
                    >
                      {section.toUpperCase()}
                    </span>
                    <span>
                      <span className="sr-only">
                        {t("summary.sectionLetter", { letter: section.toUpperCase() })}{" "}
                      </span>
                      {title}
                    </span>
                  </Heading>
                  {
                    <span className="ml-auto flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold num",
                          empty
                            ? "bg-foreground/[0.06] text-muted-foreground"
                            : "bg-primary-soft text-link",
                        )}
                      >
                        {!empty && <Check className="size-3" aria-hidden />}
                        {t("summary.answers", { count: answerCount })}
                      </span>
                      <ChevronDown
                        aria-hidden
                        className={cn(
                          "size-4 shrink-0 text-muted-foreground transition-transform duration-(--dur-2)",
                          isOpen && "rotate-180",
                        )}
                      />
                    </span>
                  }
                </button>
              ) : (
                <Heading
                  id={`summary-${section}`}
                  className="flex items-center gap-2.5 text-base font-semibold"
                >
                  <span
                    aria-hidden
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-xs font-bold text-primary-soft-foreground"
                  >
                    {section.toUpperCase()}
                  </span>
                  <span>
                    <span className="sr-only">
                      {t("summary.sectionLetter", { letter: section.toUpperCase() })}{" "}
                    </span>
                    {title}
                  </span>
                </Heading>
              )}
              {editHref && (
                <Link
                  href={editHref(section) as Route}
                  className="inline-flex tap-target items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-link hover:bg-primary/[0.06]"
                  aria-label={t("summary.editSection", { section: title })}
                >
                  <PenLine className="size-4" aria-hidden /> {t("summary.edit")}
                </Link>
              )}
            </div>
            <div id={`summary-body-${section}`} className="contents">
              {!isOpen ? null : empty ? (
                <p className={cn("text-sm text-muted-foreground", collapsible && "px-4 sm:px-5")}>
                  {t("summary.empty")}
                </p>
              ) : (
                <>
                  {plain.length > 0 && (
                    <dl
                      className={cn(
                        "grid gap-x-6 gap-y-3 sm:grid-cols-[minmax(9rem,14rem)_1fr]",
                        collapsible && "px-4 sm:px-5",
                      )}
                    >
                      {plain}
                    </dl>
                  )}
                  {listItems.map(({ spec, items }) =>
                    items.length === 0 ? null : (
                      <div
                        key={spec.list}
                        className={cn("flex flex-col gap-2", collapsible && "px-4 sm:px-5")}
                      >
                        <SubHeading className="text-sm font-semibold text-muted-foreground">
                          {t(`summary.lists.${spec.list}`, { count: items.length })}
                        </SubHeading>
                        <ol className="flex flex-col gap-2">
                          {items.map((item, index) => {
                            const heading = get(item, spec.title);
                            const titleKind =
                              spec.list === "disclosures" ? E("integrityQuestions") : undefined;
                            return (
                              <li
                                key={String(item.id ?? index)}
                                className="flex flex-col gap-2 rounded-xl bg-card p-3.5"
                              >
                                <span className="text-sm font-semibold">
                                  {index + 1}.{" "}
                                  {isEmpty(heading)
                                    ? t("summary.untitled")
                                    : render(heading, titleKind)}
                                </span>
                                <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[minmax(9rem,14rem)_1fr]">
                                  {rows(section, item, spec.fields)}
                                </dl>
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    ),
                  )}
                </>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
