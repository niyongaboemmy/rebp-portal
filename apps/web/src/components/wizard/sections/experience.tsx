"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { EXPERIENCE_CATEGORIES, type ExperienceSummary } from "@rebp/contracts";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Calendar,
  Check,
  Flag,
  Plus,
  TriangleAlert,
} from "@/components/icons";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { newId, useSection, useWizard } from "../context";
import { ItemList, type ItemListHandle } from "../item-list";
import { focusField } from "../focus";
import { useRuleSlot } from "../rules-ui";
import {
  DateField,
  FieldGroup,
  Grid,
  NumberField,
  SelectField,
  TextField,
  YesNoField,
} from "../fields";
import { StepDocuments } from "../step-documents";

/** Section E — professional experience (FR-E-001…009, Appendix A.5). */
export function SectionExperience() {
  const t = useTranslations("wizard.e");
  const { sectionContext, eligibility, locale, cv } = useWizard();
  const s = useSection("e");
  const records = s.data.records ?? [];
  const categories = EXPERIENCE_CATEGORIES.map((c) => ({ value: c, label: t(`categories.${c}`) }));
  // Which practice counts toward this category's experience rule (BR-020/021), if it has one.
  const target = sectionContext.category;
  const qualifying =
    eligibility.experience?.qualifyingCategories ??
    (target === "REA" ? ["FSLA"] : target === "BROKER" ? ["REA"] : []);
  // The coach shows the experience rule itself, so the issues block above the form doesn't repeat it.
  useRuleSlot(qualifying.length > 0 ? "e.records" : null);
  const why = (record: (typeof records)[number]) =>
    !record.category
      ? null
      : !qualifying.includes(record.category)
        ? ("category" as const)
        : !record.from
          ? ("from" as const)
          : null;

  /** A new period, already in a category that counts, opened in its dialog. */
  const list = useRef<ItemListHandle>(null);
  const addPeriod = () => list.current?.add({ category: qualifying[0] });
  // Sent to the CV to add a period ("?add=FSLA", UX-021): open one, once.
  const params = useSearchParams();
  const asked = cv ? params.get("add") : null;
  const added = useRef(false);
  useEffect(() => {
    if (!asked || added.current) return;
    added.current = true;
    list.current?.add({ category: asked });
  }, [asked]);
  const reasonText = (record: (typeof records)[number], reason: "category" | "from") =>
    reason === "category"
      ? t("coach.reasonCategory", { category: t(`categories.${record.category!}`), target })
      : t("coach.reasonFrom");
  const span = (record: (typeof records)[number]) =>
    [
      record.category && t(`categories.${record.category}`),
      record.from &&
        `${formatDay(record.from, locale)} – ${
          record.current ? t("present") : record.to ? formatDay(record.to, locale) : "…"
        }`,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <div className="flex flex-col gap-8">
      {qualifying.length > 0 && (
        <ExperienceCoach
          summary={eligibility.experience ?? null}
          qualifying={qualifying}
          target={target}
          today={sectionContext.today}
          locale={locale}
          editable={!s.disabled}
          onAdd={addPeriod}
          notCounted={records.flatMap((record, index) => {
            const reason = why(record);
            return reason ? [{ index, record, reason }] : [];
          })}
        />
      )}

      <FieldGroup title={t("recordsTitle")} description={t("recordsHint")}>
        <ItemList
          ref={list}
          section="e"
          path="records"
          items={records}
          icon={Briefcase}
          max={20}
          template={() => ({ id: newId() }) as (typeof records)[number]}
          title={(record, index) => record.firm || t("recordN", { n: index + 1 })}
          meta={(record) => span(record) || t("recordEmpty")}
          status={(record) => {
            // Whether this period counts toward the requirement, and why not.
            if (qualifying.length === 0 || !record.category) return null;
            const reason = why(record);
            return reason === null ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary-soft-foreground">
                <Check className="size-3" strokeWidth={3} aria-hidden />
                {t("coach.counts", { target })}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2 py-0.5 text-xs font-semibold text-muted-foreground dark:bg-surface-3">
                {reasonText(record, reason)}
              </span>
            );
          }}
          labels={{
            add: t("add"),
            empty: t("emptyRecords"),
            newTitle: t("newRecord"),
            remove: (n) => t("remove", { n }),
          }}
          fields={(record, index) => (
            <>
              <Grid>
                <TextField
                  section="e"
                  path={`records.${index}.firm`}
                  label={t("firm")}
                  maxLength={200}
                />
                <SelectField
                  section="e"
                  path={`records.${index}.category`}
                  label={t("category")}
                  options={categories}
                />
                <DateField
                  section="e"
                  path={`records.${index}.from`}
                  label={t("from")}
                  max={sectionContext.today}
                />
                {!record.current && (
                  <DateField
                    section="e"
                    path={`records.${index}.to`}
                    label={t("to")}
                    max={sectionContext.today}
                  />
                )}
              </Grid>
              <label className="inline-flex items-center gap-3 text-sm font-medium">
                <Checkbox
                  checked={Boolean(record.current)}
                  disabled={s.disabled}
                  onCheckedChange={(v) =>
                    s.set(
                      "records",
                      records.map((r, i) =>
                        i === index
                          ? { ...r, current: v === true, to: v === true ? undefined : r.to }
                          : r,
                      ),
                    )
                  }
                />
                {t("current")}
              </label>
              <TextField
                section="e"
                path={`records.${index}.duties`}
                label={t("duties")}
                multiline
                maxLength={2000}
              />
            </>
          )}
        />
      </FieldGroup>

      <FieldGroup title={t("registrationTitle")} description={t("registrationHint")}>
        <Grid>
          <SelectField
            section="e"
            path="priorCategoryForExperience"
            label={t("priorCategory")}
            options={categories}
          />
          <DateField
            section="e"
            path="initialRegistrationDate"
            label={t("initialRegistration")}
            max={sectionContext.today}
          />
          <SelectField
            section="e"
            path="currentCategory"
            label={t("currentCategory")}
            optional
            options={categories.filter((c) => c.value !== "EQUIVALENT")}
          />
          <TextField
            section="e"
            path="previousLicenceNo"
            label={t("previousLicence")}
            optional
            maxLength={40}
          />
          <NumberField
            section="e"
            path="declaredYears"
            label={t("declaredYears")}
            description={t("declaredHint")}
            optional
            min={0}
            max={70}
            step={0.5}
          />
        </Grid>
      </FieldGroup>

      <FieldGroup>
        <YesNoField
          section="e"
          path="equivalentRecognised"
          label={t("equivalent")}
          description={t("equivalentHint")}
        />
        {s.data.equivalentRecognised && (
          <TextField
            section="e"
            path="equivalenceReference"
            label={t("equivalenceReference")}
            maxLength={80}
          />
        )}
      </FieldGroup>

      <FieldGroup title={t("refereeTitle")} description={t("refereeHint")}>
        <Grid>
          <TextField
            section="e"
            path="refereeName"
            label={t("refereeName")}
            optional
            maxLength={120}
          />
          <TextField
            section="e"
            path="refereeRole"
            label={t("refereeRole")}
            optional
            maxLength={120}
          />
          <TextField
            section="e"
            path="refereePhone"
            label={t("refereePhone")}
            optional
            type="tel"
            maxLength={20}
          />
          <TextField
            section="e"
            path="refereeEmail"
            label={t("refereeEmail")}
            optional
            type="email"
            maxLength={254}
          />
        </Grid>
      </FieldGroup>

      <StepDocuments step="e" />
    </div>
  );
}

export type NotCounted = {
  index: number;
  record: { category?: string; firm?: string };
  reason: "category" | "from";
};

/**
 * FR-E-008 and UX-016: the experience requirement as a coach, not just a chart. The bar fills
 * toward the requirement with the gap spelled out; while short, the ways to close it are one tap
 * away (add a period that counts — prefilled — or a recognised equivalence for REA), and any
 * period entered that doesn't count says why, with a way to fix it. Qualifying periods sit on a
 * time axis (register-verified vs declared), suspensions removed, with the date the threshold is
 * or will be met.
 */
export function ExperienceCoach({
  summary,
  qualifying,
  target,
  today,
  locale,
  editable,
  onAdd,
  notCounted,
  go = focusField,
}: {
  summary: ExperienceSummary | null;
  qualifying: string[];
  target: string;
  today: string;
  locale: string;
  editable: boolean;
  onAdd: () => void;
  notCounted: NotCounted[];
  /** Takes the applicant to an answer: on this page, or in the CV (application summary). */
  go?: (path: string) => void;
}) {
  const t = useTranslations("wizard.e.timeline");
  const tc = useTranslations("wizard.e.coach");
  const te = useTranslations("wizard.e");
  const requiredMonths = summary?.requiredMonths ?? 36;
  const months = summary?.months ?? 0;
  const days = summary?.days ?? 0;
  const periods = summary?.qualifying ?? [];
  const requiredDays = Math.ceil((requiredMonths * 365.25) / 12);
  const met = days >= requiredDays;
  const gap = Math.max(0, requiredMonths - months);
  const percent = Math.min(100, Math.round((days / requiredDays) * 100));
  const counted = qualifying.map((c) => te(`categories.${c}` as "categories.FSLA")).join(", ");
  const [hover, setHover] = useState<number | null>(null);
  const years = Math.floor(months / 12);

  // Each period as a slice of the ring, in proportion to its length, filling up to the share of
  // the requirement it covers (overlaps are counted once, so slices are scaled to the total).
  const lengths = periods.map((p) =>
    Math.max(1, (Date.parse(p.to) - Date.parse(p.from)) / 86_400_000 + 1),
  );
  const total = lengths.reduce((a, b) => a + b, 0) || 1;
  const filled = Math.min(1, days / requiredDays);
  const sizes = lengths.map((length) => (length / total) * filled);
  const slices = sizes.map((size, i) => ({
    start: sizes.slice(0, i).reduce((a, b) => a + b, 0),
    size,
  }));
  const R = 42;
  const C = 2 * Math.PI * R;

  return (
    <section
      aria-labelledby="xp-title"
      className="flex flex-col gap-4 rounded-2xl bg-[linear-gradient(160deg,color-mix(in_oklch,var(--primary)_7%,var(--card)),var(--card)_65%)] p-4 ring-1 ring-primary/10 sm:p-5 dark:bg-[linear-gradient(160deg,color-mix(in_oklch,var(--primary)_16%,transparent),transparent_65%)] dark:ring-white/[0.06]"
    >
      <div className="grid items-center gap-4 @md/form:grid-cols-[auto_minmax(0,1fr)]">
        {/* The requirement as a ring: one slice per period, a flag at the target. */}
        <div
          role="img"
          aria-label={`${t("total", { years, months: months % 12, required: Math.round(requiredMonths / 12) })} · ${t("progress", { percent })}`}
          className="relative mx-auto size-28 shrink-0"
        >
          <svg viewBox="0 0 100 100" className="size-full -rotate-90">
            <circle
              cx="50"
              cy="50"
              r={R}
              fill="none"
              strokeWidth="9"
              className="stroke-foreground/[0.07] dark:stroke-white/[0.08]"
            />
            {slices.map((slice, i) => (
              <circle
                key={i}
                cx="50"
                cy="50"
                r={R}
                fill="none"
                strokeWidth={hover === i ? 11 : 9}
                strokeLinecap={slices.length === 1 ? "round" : "butt"}
                strokeDasharray={`${Math.max(0.5, slice.size * C - (slices.length > 1 ? 1.5 : 0))} ${C}`}
                strokeDashoffset={-slice.start * C}
                className={cn(
                  "animate-ring-draw transition-[stroke-width,opacity] duration-(--dur-2)",
                  periods[i]!.source === "register" ? "stroke-primary" : "stroke-primary/55",
                  hover !== null && hover !== i && "opacity-35",
                )}
              />
            ))}
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
            <span className={cn("text-2xl font-bold num", met ? "text-link" : "text-foreground")}>
              {years > 0 ? (
                <>
                  {years}
                  <span className="text-sm">y</span>
                </>
              ) : (
                <>
                  {months}
                  <span className="text-sm">m</span>
                </>
              )}
            </span>
            <span className="mt-1 text-[0.65rem] font-semibold text-muted-foreground">
              {tc("ofYears", { required: Math.round(requiredMonths / 12) })}
            </span>
          </span>
          {/* The target, at the top of the ring. */}
          <span
            aria-hidden
            className={cn(
              "absolute -top-1 left-1/2 inline-flex size-6 -translate-x-1/2 items-center justify-center rounded-full ring-2 ring-card",
              met
                ? "bg-card text-link ring-1 ring-primary/30"
                : "bg-card text-destructive shadow-sm",
            )}
          >
            {met ? <Check className="size-3.5" strokeWidth={3} /> : <Flag className="size-3.5" />}
          </span>
        </div>

        <div className="flex min-w-0 flex-col gap-2.5">
          <h3 id="xp-title" className="text-base font-semibold">
            {t("title")}
          </h3>
          {/* What's left and what counts, as pills, not a sentence (UX-020). */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
            {met ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-primary-soft-foreground">
                <BadgeCheck className="size-3.5" aria-hidden /> {tc("metShort", { target })}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-1 text-destructive">
                <Flag className="size-3.5" aria-hidden />
                {tc("toGo", {
                  duration: tc("duration", {
                    years: Math.floor(gap / 12),
                    months: gap % 12,
                    both: gap >= 12 && gap % 12 > 0 ? "yes" : "no",
                  }),
                })}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-foreground ring-1 ring-foreground/[0.08] dark:bg-surface-2">
              <Check className="size-3.5 text-link" strokeWidth={3} aria-hidden />
              {tc("countsShort", { category: counted })}
            </span>
            {summary?.eligibleFrom && !met && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-primary-soft-foreground">
                <Calendar className="size-3.5" aria-hidden />
                {tc("eligibleOn", { date: formatDay(summary.eligibleFrom, locale) })}
              </span>
            )}
          </div>

          {/* The periods as chips, only as wide as their text; each lights its slice. */}
          {periods.length > 0 && (
            <ul aria-label={t("periods")} className="flex flex-wrap gap-1.5">
              {periods.map((p, i) => (
                <li key={`${p.from}-${i}`}>
                  <span
                    tabIndex={0}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    title={p.source === "register" ? t("register") : t("declared")}
                    className={cn(
                      "inline-flex w-max items-center gap-1.5 rounded-full bg-card py-1 pr-2.5 pl-1.5 text-xs font-semibold ring-1 transition-[box-shadow,transform] duration-(--dur-2) outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-surface-2",
                      hover === i
                        ? "-translate-y-px shadow-[0_6px_16px_-10px_var(--primary)] ring-primary/40"
                        : "ring-foreground/[0.08] dark:ring-white/[0.08]",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "size-3 rounded-full",
                        p.source === "register" ? "bg-primary" : "bg-primary/55",
                      )}
                    />
                    <span className="sr-only">
                      {p.source === "register" ? t("register") : t("declared")}:{" "}
                    </span>
                    {p.category} · {formatDay(p.from, locale)}
                    {p.to < today && ` – ${formatDay(p.to, locale)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {periods.length > 0 && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[0.7rem] text-muted-foreground">
              <li className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-primary" aria-hidden /> {t("register")}
              </li>
              <li className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-primary/55" aria-hidden /> {t("declared")}
              </li>
              {summary?.overlapsMerged && <li>{t("merged")}</li>}
              {summary && summary.excluded.length > 0 && (
                <li>{t("excluded", { count: summary.excluded.length })}</li>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* Periods entered that don't count, each with why and a way to fix it. */}
      {notCounted.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold">{tc("notCounted")}</h4>
          <ul className="flex flex-col gap-1.5">
            {notCounted.map(({ index, record, reason }) => (
              <li key={index}>
                <button
                  type="button"
                  onClick={() =>
                    go(`records.${index}.${reason === "category" ? "category" : "from"}`)
                  }
                  className="group flex w-full items-center gap-3 rounded-xl bg-card px-3 py-2.5 text-left text-sm ring-1 ring-foreground/[0.06] transition-[box-shadow] hover:shadow-[0_8px_22px_-14px_oklch(0.35_0.15_264/0.45)] dark:bg-surface-2"
                >
                  <TriangleAlert className="size-4 shrink-0 text-link" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">
                      {record.firm || te("recordN", { n: index + 1 })}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      ·{" "}
                      {reason === "category"
                        ? tc("reasonCategory", {
                            category: te(`categories.${record.category}` as "categories.FSLA"),
                            target,
                          })
                        : tc("reasonFrom")}
                    </span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-link">
                    {tc("fix")}
                    <ArrowRight
                      className="size-3.5 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* While short: the ways to close the gap, one tap each. */}
      {!met && editable && (
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold">
            {tc("waysTitle", { required: Math.round(requiredMonths / 12) })}
          </h4>
          <div className="grid grid-cols-1 gap-2 @2xl/form:grid-cols-2">
            <button
              type="button"
              onClick={onAdd}
              className="group flex items-start gap-3 rounded-2xl bg-card p-4 text-left shadow-[0_1px_2px_oklch(0.3_0.08_264/0.06)] ring-1 ring-primary/15 transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-18px_oklch(0.35_0.15_264/0.5)] dark:bg-surface-2"
            >
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Plus className="size-4" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-semibold">
                  {tc("addPeriod", { category: counted })}
                </span>
              </span>
            </button>
            {target === "REA" && (
              <button
                type="button"
                onClick={() => go("equivalentRecognised")}
                className="group flex items-start gap-3 rounded-2xl bg-card p-4 text-left shadow-[0_1px_2px_oklch(0.3_0.08_264/0.06)] ring-1 ring-foreground/[0.06] transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-18px_oklch(0.35_0.15_264/0.5)] dark:bg-surface-2"
              >
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                  <BadgeCheck className="size-4" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-semibold">{tc("equivalence")}</span>
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
