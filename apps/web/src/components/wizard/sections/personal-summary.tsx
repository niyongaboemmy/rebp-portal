"use client";

import { useTranslations } from "next-intl";
import type { Route } from "next";
import Link from "next/link";
import { useMemo } from "react";
import type { Address } from "@rebp/contracts";
import {
  BookUser,
  Briefcase,
  Cake,
  Globe2,
  Home,
  Mail,
  PenLine,
  Phone,
  UserRound,
  type LucideIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { GuidedMessage } from "@/components/ui/guided-message";
import { countryOptions } from "@/lib/countries";
import { formatDay } from "@/lib/format";
import { useWizard } from "../context";
import { fileUrl } from "../document-visuals";
import { StepDocuments } from "../step-documents";

/**
 * Section B from the applicant's profile (UX-010): nothing to retype. A compact summary of the
 * personal details every application reuses, a way to change them (in the profile, which
 * updates this draft), and the uploads this application needs.
 */
export function PersonalFromProfile() {
  const t = useTranslations("wizard.b");
  const tp = useTranslations("wizard.profileStep");
  const { data, application, divisionNames, locale, issues, documents } = useWizard();
  // The profile photo, as copied into this application (UX-011).
  const photo = documents.find(
    (d) => d.type === "photo" && d.status !== "INFECTED" && d.status !== "REJECTED_FILE",
  );
  const b = data.b ?? {};
  const incomplete = Object.keys(issues("b")).length > 0;
  const countries = useMemo(
    () => new Map(countryOptions(locale).map((c) => [c.code, c.name])),
    [locale],
  );
  const edit = `/settings/profile?next=${encodeURIComponent(
    `/applications/${application.id}/wizard?step=b`,
  )}` as Route;

  const place = (address?: Address) =>
    !address
      ? undefined
      : address.abroad
        ? address.abroadText
        : [address.village, address.cell, address.sector, address.district, address.province]
            .filter(Boolean)
            .map((code) => divisionNames[code!] ?? code)
            .join(", ") || undefined;

  const rows: Array<{ icon: LucideIcon; label: string; value?: string }> = [
    {
      icon: UserRound,
      label: tp("name"),
      value: [b.givenNames, b.otherNames, b.surname].filter(Boolean).join(" ") || undefined,
    },
    {
      icon: BookUser,
      label: t("idTitle"),
      value: b.idType && b.idNumber ? `${t(`idTypes.${b.idType}`)} · ${b.idNumber}` : undefined,
    },
    {
      icon: Cake,
      label: t("dateOfBirth"),
      value: b.dateOfBirth ? formatDay(b.dateOfBirth, locale) : undefined,
    },
    {
      icon: Globe2,
      label: t("nationality"),
      value: b.nationality?.map((c) => countries.get(c) ?? c).join(", ") || undefined,
    },
    { icon: Phone, label: t("phone"), value: b.phone },
    { icon: Mail, label: t("email"), value: b.email },
    { icon: Home, label: t("residential"), value: place(b.residentialAddress) },
    {
      icon: Briefcase,
      label: t("occupation"),
      value: [b.occupation, b.employer].filter(Boolean).join(" · ") || undefined,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="from-profile" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft text-primary-soft-foreground shadow-[0_4px_12px_-6px_oklch(0.3_0.1_264/0.5)] ring-2 ring-card">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- authorised, per-user file
                <img src={fileUrl(photo)} alt="" className="size-full object-cover" />
              ) : (
                <UserRound className="size-5" aria-hidden />
              )}
            </span>
            <div className="flex flex-col gap-0.5">
              <h3 id="from-profile" className="text-base font-semibold">
                {tp("title")}
              </h3>
              <p className="text-sm text-muted-foreground">{tp("hint")}</p>
            </div>
          </div>
          <Button asChild variant="tonal" size="sm" className="rounded-full">
            <Link href={edit}>
              <PenLine aria-hidden /> {tp("edit")}
            </Link>
          </Button>
        </div>
        {incomplete && (
          <GuidedMessage
            tone="critical"
            title={tp("incomplete")}
            fix={tp("incompleteFix")}
            data-path="profile"
          />
        )}
        <dl className="grid gap-x-6 gap-y-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.06] sm:p-5 @xl/form:grid-cols-2 dark:bg-surface-2/70 dark:ring-white/[0.06]">
          {rows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex min-w-0 items-start gap-3">
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                <Icon className="size-4" aria-hidden />
              </span>
              <div className="flex min-w-0 flex-col">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="truncate text-sm font-medium">
                  {value ?? <span className="text-destructive">{tp("missing")}</span>}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </section>
      <StepDocuments step="b" />
    </div>
  );
}
