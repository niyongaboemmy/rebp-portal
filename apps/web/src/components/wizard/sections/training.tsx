"use client";

import { useTranslations } from "next-intl";
import {
  EXAM_ANSWERS,
  EXAM_CATEGORIES,
  REQUIRED_TRAINING,
  TRAINING_PROVIDERS,
  TRAINING_PROGRAMME_TYPES,
} from "@rebp/contracts";
import { Alert } from "@/components/ui/alert";
import { useSection, useWizard } from "../context";
import {
  ChoiceCards,
  DateField,
  FieldGroup,
  Grid,
  SelectField,
  TextField,
  YesNoField,
} from "../fields";
import { StepDocuments } from "../step-documents";

/** Section D — training and examinations (FR-D-001…008, Appendix A.4). */
export function SectionTraining() {
  const t = useTranslations("wizard.d");
  const { application, sectionContext, cv } = useWizard();
  const s = useSection("d");
  // On the CV (UX-018) no category is chosen yet: nothing is required, every answer is allowed.
  const required = cv ? undefined : REQUIRED_TRAINING[application.category];
  const hasExam = !cv && EXAM_CATEGORIES.includes(application.category);
  const provider = TRAINING_PROVIDERS.find((p) => p.code === s.data.trainingProvider);
  const programmes = provider ? provider.programmes : TRAINING_PROGRAMME_TYPES;

  return (
    <div className="flex flex-col gap-8">
      <FieldGroup
        title={t("trainingTitle")}
        description={
          cv
            ? t("cvTrainingHint")
            : required
              ? t("requiredTraining", { programme: t(`programmes.${required}`) })
              : t("noTrainingRequired")
        }
      >
        <YesNoField section="d" path="trainingCompleted" label={t("trainingCompleted")} />
        {s.data.trainingCompleted === false && required && (
          <Alert variant="warning">
            {t("trainingMissing", { programme: t(`programmes.${required}`) })}
          </Alert>
        )}
        {s.data.trainingCompleted && (
          <Grid>
            <SelectField
              section="d"
              path="trainingProvider"
              label={t("provider")}
              options={[
                ...TRAINING_PROVIDERS.map((p) => ({
                  value: p.code,
                  label: t(`providers.${p.code}`),
                })),
                { value: "OTHER", label: t("providers.OTHER") },
              ]}
            />
            {s.data.trainingProvider === "OTHER" && (
              <TextField
                section="d"
                path="trainingProviderOther"
                label={t("providerOther")}
                maxLength={200}
              />
            )}
            <SelectField
              section="d"
              path="trainingProgramme"
              label={t("programme")}
              options={programmes.map((p) => ({ value: p, label: t(`programmes.${p}`) }))}
            />
            <DateField
              section="d"
              path="trainingCompletedOn"
              label={t("completedOn")}
              max={sectionContext.today}
            />
            <TextField
              section="d"
              path="trainingCertificateNo"
              label={t("certificateNo")}
              maxLength={60}
            />
          </Grid>
        )}
      </FieldGroup>

      <FieldGroup
        title={t("examTitle")}
        description={cv ? t("cvExamHint") : hasExam ? t("examRequired") : t("examNotRequired")}
      >
        <ChoiceCards
          section="d"
          path="examPassed"
          label={t("examPassed")}
          columns={3}
          options={EXAM_ANSWERS.filter((a) => a !== "NOT_APPLICABLE" || !hasExam).map((a) => ({
            value: a,
            label: t(`exam.${a}`),
          }))}
        />
        {s.data.examPassed === "YES" && (
          <Grid>
            <TextField section="d" path="examReference" label={t("examReference")} maxLength={60} />
            <DateField
              section="d"
              path="examDate"
              label={t("examDate")}
              description={t("examValidity")}
              max={sectionContext.today}
            />
          </Grid>
        )}
      </FieldGroup>

      <StepDocuments step="d" />
    </div>
  );
}
