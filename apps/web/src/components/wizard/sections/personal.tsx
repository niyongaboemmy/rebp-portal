"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { GENDERS, ID_TYPES, normalisePhone } from "@rebp/contracts";
import { Field, FieldControl } from "@/components/ui/field";
import { countryOptions } from "@/lib/countries";
import { AddressField } from "../address-field";
import { useSection, useWizard } from "../context";
import {
  DateField,
  FieldGroup,
  Grid,
  NativeSelect,
  SelectField,
  TextField,
  YesNoField,
} from "../fields";
import { StepDocuments } from "../step-documents";

/** Section B — personal information (FR-B-001…016, Appendix A.2). */
export function SectionPersonal({
  withDocuments = true,
  extra,
}: {
  withDocuments?: boolean;
  /** More topics after the form's own (the profile's identity documents). */
  extra?: React.ReactNode;
} = {}) {
  const t = useTranslations("wizard.b");
  const { sectionContext, locale } = useWizard();
  const s = useSection("b");
  const countries = useMemo(
    () => countryOptions(locale).map((c) => ({ value: c.code, label: c.name })),
    [locale],
  );
  const nationality = s.data.nationality ?? [];
  const setNationality = (index: number, value: string | undefined) => {
    const next = [...nationality];
    if (value) next[index] = value;
    else next.splice(index, 1);
    s.set("nationality", next.filter(Boolean));
  };

  return (
    <div className="flex flex-col gap-8">
      <FieldGroup title={t("nameTitle")} description={t("nameHint")}>
        <Grid>
          <TextField
            section="b"
            path="surname"
            label={t("surname")}
            autoComplete="family-name"
            maxLength={100}
          />
          <TextField
            section="b"
            path="givenNames"
            label={t("givenNames")}
            autoComplete="given-name"
            maxLength={100}
          />
          <TextField
            section="b"
            path="otherNames"
            label={t("otherNames")}
            optional
            maxLength={100}
          />
          <TextField
            section="b"
            path="fullNameOnId"
            label={t("fullNameOnId")}
            optional
            maxLength={200}
          />
        </Grid>
      </FieldGroup>

      <FieldGroup title={t("idTitle")}>
        <Grid>
          <SelectField
            section="b"
            path="idType"
            label={t("idType")}
            options={ID_TYPES.map((v) => ({ value: v, label: t(`idTypes.${v}`) }))}
          />
          <TextField
            section="b"
            path="idNumber"
            label={t("idNumber")}
            description={s.data.idType === "NATIONAL_ID" ? t("nidHint") : undefined}
            inputMode={s.data.idType === "NATIONAL_ID" ? "numeric" : "text"}
            maxLength={30}
            transform={(v) =>
              s.data.idType === "NATIONAL_ID"
                ? v.replace(/\D/g, "")
                : v.toUpperCase().replace(/\s/g, "")
            }
          />
          {s.data.idType === "PASSPORT" && (
            <>
              <SelectField
                section="b"
                path="idCountry"
                label={t("idCountry")}
                options={countries}
              />
              <DateField
                section="b"
                path="idExpiry"
                label={t("idExpiry")}
                min={sectionContext.today}
              />
            </>
          )}
          <DateField
            section="b"
            path="dateOfBirth"
            label={t("dateOfBirth")}
            description={t("dobHint")}
            max={sectionContext.today}
          />
          {sectionContext.flags?.genderField && (
            <SelectField
              section="b"
              path="gender"
              label={t("gender")}
              options={GENDERS.map((v) => ({ value: v, label: t(`genders.${v}`) }))}
            />
          )}
        </Grid>
        <Grid>
          <Field label={t("nationality")} error={s.error("nationality")} data-path="nationality">
            <FieldControl>
              <NativeSelect
                value={nationality[0]}
                onChange={(v) => setNationality(0, v)}
                options={countries}
                disabled={s.disabled}
              />
            </FieldControl>
          </Field>
          <Field
            label={
              <>
                {t("secondNationality")}{" "}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  ({t("optional")})
                </span>
              </>
            }
          >
            <FieldControl>
              <NativeSelect
                value={nationality[1]}
                onChange={(v) => setNationality(1, v)}
                options={countries}
                disabled={s.disabled || !nationality[0]}
              />
            </FieldControl>
          </Field>
        </Grid>
      </FieldGroup>

      <FieldGroup title={t("contactTitle")} description={t("contactHint")}>
        <Grid>
          <TextField
            section="b"
            path="phone"
            label={t("phone")}
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            maxLength={20}
            transform={(v) => (v.replace(/\D/g, "").length >= 10 ? normalisePhone(v) : v)}
          />
          <TextField
            section="b"
            path="email"
            label={t("email")}
            type="email"
            autoComplete="email"
            maxLength={254}
          />
        </Grid>
      </FieldGroup>

      {/* Its own topic, so a paged form gives the address a step of its own. */}
      <FieldGroup title={t("addressTitle")}>
        <AddressField section="b" path="residentialAddress" legend={t("residential")} />
        <YesNoField section="b" path="professionalSameAsResidential" label={t("sameAddress")} />
        {s.data.professionalSameAsResidential === false && (
          <AddressField section="b" path="professionalAddress" legend={t("professional")} />
        )}
      </FieldGroup>

      <FieldGroup title={t("workTitle")}>
        <Grid>
          <TextField section="b" path="occupation" label={t("occupation")} maxLength={100} />
          <TextField section="b" path="employer" label={t("employer")} optional maxLength={150} />
        </Grid>
      </FieldGroup>

      {/* The profile page reuses this form without the application's uploads (UX-010). */}
      {withDocuments && <StepDocuments step="b" />}
      {extra}
    </div>
  );
}
