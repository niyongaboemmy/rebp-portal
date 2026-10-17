"use client";

import { useTranslations } from "next-intl";
import { EDUCATION_LEVELS_C, FIELDS_OF_STUDY, type Qualification } from "@rebp/contracts";
import { Check, GraduationCap } from "@/components/icons";
import { Checkbox } from "@/components/ui/checkbox";
import { newId, useSection, useWizard } from "../context";
import { ItemList } from "../item-list";
import { FieldGroup, Grid, NumberField, SelectField, TextField, YesNoField } from "../fields";
import { StepDocuments } from "../step-documents";

/** Section C — education (FR-C-001…006, Appendix A.3): repeatable qualifications, one or more relied upon. */
export function SectionEducation() {
  const t = useTranslations("wizard.c");
  const { sectionContext, cv } = useWizard();
  const s = useSection("c");
  const list = s.data.qualifications ?? [];
  const year = Number(sectionContext.today.slice(0, 4));

  const setRelied = (index: number, value: boolean) =>
    s.set(
      "qualifications",
      list.map((q, i) => (i === index ? { ...q, reliedUpon: value } : q)),
    );

  return (
    <div className="flex flex-col gap-8">
      <SelectField
        section="c"
        path="highestLevel"
        label={t("highestLevel")}
        description={t("highestHint")}
        options={EDUCATION_LEVELS_C.map((v) => ({ value: v, label: t(`levels.${v}`) }))}
        className="max-w-md"
      />

      <FieldGroup title={t("qualificationsTitle")} description={t("qualificationsHint")}>
        <ItemList
          section="c"
          path="qualifications"
          items={list}
          icon={GraduationCap}
          max={10}
          template={() =>
            ({ id: newId(), isForeign: false, reliedUpon: list.length === 0 }) as Qualification
          }
          title={(q, index) => q.qualification || t("qualificationN", { n: index + 1 })}
          meta={(q) =>
            [q.institution, q.yearCompleted].filter(Boolean).join(" · ") || t("qualificationEmpty")
          }
          status={(q) =>
            // Which qualification an application relies on is that application's choice (UX-018).
            !cv && q.reliedUpon ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary-soft-foreground">
                <Check className="size-3" strokeWidth={3} aria-hidden />
                {t("reliedChip")}
              </span>
            ) : null
          }
          labels={{
            add: t("add"),
            empty: t("qualificationsEmpty"),
            newTitle: t("newQualification"),
            remove: (n) => t("remove", { n }),
          }}
          fields={(q, index) => (
            <>
              <Grid>
                <TextField
                  section="c"
                  path={`qualifications.${index}.institution`}
                  label={t("institution")}
                  maxLength={200}
                />
                <TextField
                  section="c"
                  path={`qualifications.${index}.qualification`}
                  label={t("qualification")}
                  maxLength={200}
                />
                <SelectField
                  section="c"
                  path={`qualifications.${index}.fieldOfStudy`}
                  label={t("fieldOfStudy")}
                  options={FIELDS_OF_STUDY.map((v) => ({ value: v, label: t(`fields.${v}`) }))}
                />
                {q.fieldOfStudy === "OTHER" && (
                  <TextField
                    section="c"
                    path={`qualifications.${index}.fieldOther`}
                    label={t("fieldOther")}
                    maxLength={120}
                  />
                )}
                <NumberField
                  section="c"
                  path={`qualifications.${index}.yearCompleted`}
                  label={t("yearCompleted")}
                  min={1950}
                  max={year}
                />
                <TextField
                  section="c"
                  path={`qualifications.${index}.certificateNo`}
                  label={t("certificateNo")}
                  optional
                  maxLength={60}
                />
              </Grid>
              <YesNoField
                section="c"
                path={`qualifications.${index}.isForeign`}
                label={t("isForeign")}
                description={q.isForeign ? t("foreignHint") : undefined}
              />
              {!cv && (
                <label className="inline-flex items-center gap-3 text-sm font-medium">
                  <Checkbox
                    checked={Boolean(q.reliedUpon)}
                    disabled={s.disabled}
                    onCheckedChange={(v) => setRelied(index, v === true)}
                  />
                  {t("reliedUpon")}
                </label>
              )}
            </>
          )}
        />
      </FieldGroup>

      <StepDocuments step="c" />
    </div>
  );
}
