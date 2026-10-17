"use client";

import { useTranslations } from "next-intl";
import { INTEGRITY_QUESTIONS, type IntegrityQuestion } from "@rebp/contracts";
import { Lock, ShieldAlert, ShieldCheck } from "@/components/icons";
import { cn } from "@/lib/utils";
import { focusField } from "../focus";
import { Alert } from "@/components/ui/alert";
import { newId, useSection, useWizard } from "../context";
import { ItemList } from "../item-list";
import { formatDay } from "@/lib/format";
import { DateField, FieldGroup, Grid, SelectField, TextField, YesNoField } from "../fields";
import { StepDocuments } from "../step-documents";

/**
 * Section H — compliance and integrity (FR-H-001…006, Appendix A.8). A "Yes" never rejects
 * (BR-060): it asks for details and routes to assessment. "No" to the code of conduct blocks
 * submission (BR-062). Answers are Highly Sensitive (FR-H-006).
 */
export function SectionIntegrity() {
  const t = useTranslations("wizard.h");
  const { sectionContext, locale } = useWizard();
  const s = useSection("h");
  const yes = INTEGRITY_QUESTIONS.filter((q) => s.data[q] === true);
  const disclosures = s.data.disclosures ?? [];

  return (
    <div className="flex flex-col gap-8">
      {/* The declaration at a glance (UX-023): a shield per question — open, "No", or "Yes"
          (details needed) — each a way to its question; and who can see the answers. */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-[linear-gradient(160deg,color-mix(in_oklch,var(--primary)_6%,var(--card)),var(--card)_70%)] p-3.5 ring-1 ring-primary/10 dark:bg-surface-2/70 dark:ring-white/[0.06]">
        <ol aria-label={t("trackerLabel")} className="flex items-center gap-1.5">
          {INTEGRITY_QUESTIONS.map((q, i) => {
            const answer = s.data[q];
            return (
              <li key={q}>
                <button
                  type="button"
                  onClick={() => focusField(q)}
                  aria-label={`${i + 1}. ${t(`short.${q}`)}: ${
                    answer === undefined
                      ? t("tracker.open")
                      : answer
                        ? t("tracker.yes")
                        : t("tracker.no")
                  }`}
                  className={cn(
                    "relative inline-flex size-10 items-center justify-center rounded-xl transition-[transform,background-color] duration-(--dur-2) hover:-translate-y-0.5",
                    answer === undefined &&
                      "border border-dashed border-foreground/25 bg-card text-muted-foreground dark:bg-surface-2",
                    answer === false && "bg-primary text-primary-foreground",
                    answer === true && "bg-primary-soft text-link ring-2 ring-primary/40",
                  )}
                >
                  {answer === false ? (
                    <ShieldCheck className="size-5" aria-hidden />
                  ) : answer === true ? (
                    <ShieldAlert className="size-5" aria-hidden />
                  ) : (
                    <span className="text-xs font-bold num">{i + 1}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
        <span className="text-xs font-semibold num text-muted-foreground">
          {t("trackerCount", {
            done: INTEGRITY_QUESTIONS.filter((q) => s.data[q] !== undefined).length,
            total: INTEGRITY_QUESTIONS.length,
          })}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground @lg/form:ml-auto">
          <Lock className="size-3.5 shrink-0 text-link" aria-hidden />
          {t("sensitiveShort")}
        </span>
      </div>

      <FieldGroup title={t("questionsTitle")}>
        {INTEGRITY_QUESTIONS.map((q) => (
          <YesNoField key={q} section="h" path={q} label={t(`questions.${q}`)} />
        ))}
        {yes.length > 0 && <Alert variant="info">{t("yesNote")}</Alert>}
      </FieldGroup>

      {yes.length > 0 && (
        <FieldGroup title={t("disclosuresTitle")} description={t("disclosuresHint")}>
          <ItemList
            section="h"
            path="disclosures"
            items={disclosures}
            icon={ShieldAlert}
            max={10}
            template={() => ({ id: newId(), question: yes[0] }) as (typeof disclosures)[number]}
            title={(d, index) =>
              d.question ? t(`short.${d.question}`) : t("disclosureN", { n: index + 1 })
            }
            meta={(d) =>
              [d.authority, d.date && formatDay(d.date, locale)].filter(Boolean).join(" · ") ||
              t("disclosureEmpty")
            }
            labels={{
              add: t("add"),
              empty: t("disclosuresEmpty"),
              newTitle: t("newDisclosure"),
              remove: (n) => t("remove", { n }),
            }}
            fields={(_d, index) => (
              <>
                <SelectField
                  section="h"
                  path={`disclosures.${index}.question`}
                  label={t("question")}
                  options={yes.map((q: IntegrityQuestion) => ({
                    value: q,
                    label: t(`short.${q}`),
                  }))}
                />
                <TextField
                  section="h"
                  path={`disclosures.${index}.nature`}
                  label={t("nature")}
                  multiline
                  maxLength={500}
                />
                <Grid>
                  <DateField
                    section="h"
                    path={`disclosures.${index}.date`}
                    label={t("date")}
                    max={sectionContext.today}
                  />
                  <TextField
                    section="h"
                    path={`disclosures.${index}.authority`}
                    label={t("authority")}
                    maxLength={200}
                  />
                </Grid>
                <TextField
                  section="h"
                  path={`disclosures.${index}.outcome`}
                  label={t("outcome")}
                  multiline
                  maxLength={500}
                />
                <TextField
                  section="h"
                  path={`disclosures.${index}.currentStatus`}
                  label={t("currentStatus")}
                  optional
                  maxLength={200}
                />
              </>
            )}
          />
        </FieldGroup>
      )}

      <FieldGroup title={t("certificateTitle")}>
        <DateField
          section="h"
          path="criminalRecordIssuedOn"
          label={t("criminalRecordIssuedOn")}
          description={t("criminalRecordHint")}
          max={sectionContext.today}
          className="max-w-xs"
        />
      </FieldGroup>

      <FieldGroup title={t("codeTitle")} description={t("codeHint")}>
        <YesNoField section="h" path="codeOfConduct" label={t("codeOfConduct")} />
        {s.data.codeOfConduct === false && <Alert variant="danger">{t("codeBlocking")}</Alert>}
      </FieldGroup>

      <StepDocuments step="h" />
    </div>
  );
}
