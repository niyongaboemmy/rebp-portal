"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  LEGAL_FORMS,
  PRINCIPAL_RESPONSIBILITIES,
  SUPERVISORY_FUNCTIONS,
  ID_TYPES,
} from "@rebp/contracts";
import {
  Building2,
  Check,
  ClipboardCheck,
  Eye,
  Handshake,
  Home,
  MapPin,
  MessageSquare,
  Money,
  ShieldCheck,
  Signature,
  UserCheck,
  UserRound,
  Users,
  Wallet,
} from "@/components/icons";
import { Checkbox } from "@/components/ui/checkbox";
import { chipClassName } from "@/components/ui/chip";
import { useErrorMessage } from "@/hooks/use-error-message";
import { countryOptions } from "@/lib/countries";
import { HOVER, INTERACTIVE, SELECTED, SURFACE_MUTED } from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import { AddressField, loadDivisions } from "../address-field";
import { IssueCard, MetTile } from "../issue-card";
import { RuleDigest } from "../rule-digest";
import { newId, useSection, useWizard, type Division } from "../context";
import { ItemList } from "../item-list";
import {
  AckField,
  DateField,
  FieldGroup,
  Grid,
  NumberField,
  SelectField,
  TextField,
  YesNoField,
} from "../fields";
import { LicenceLookup } from "../lookups";
import { StepDocuments } from "../step-documents";

/**
 * Section G — the one subsection that matches the category (FR-G-000). Data from B–F is re-used,
 * not re-entered: the subsection confirms it (with the engine's verdicts) and adds only the
 * category-unique items (Appendix A.7).
 */
export function SectionCategory() {
  const { application } = useWizard();
  switch (application.category) {
    case "RERA":
      return <G1 />;
    case "FSLA":
      return <G2 />;
    case "REA":
    case "BROKER":
      return <G34 />;
    case "ASSOCIATE_BROKER":
      return <G5 />;
    case "MANAGING_BROKER":
      return <G6 />;
    case "PRINCIPAL_BROKER":
      return <G7 />;
    case "REBF":
      return <G8 />;
  }
}

/** Engine verdicts on data already given, so the applicant confirms rather than re-enters. */
function Reused({ ids }: { ids: string[] }) {
  const t = useTranslations("wizard.g");
  const { eligibility, locale } = useWizard();
  const rules = eligibility.rules.filter((r) => ids.includes(r.id));
  return (
    <FieldGroup title={t("reusedTitle")} description={t("reusedHint")}>
      {rules.length > 0 ? (
        // What needs work as cards with their one action; what's settled as a grid of ticks.
        <div className="flex flex-col gap-3">
          {rules.some((r) => r.outcome !== "PASS") && (
            <ul className="flex flex-col gap-2.5">
              {rules
                .filter((r) => r.outcome !== "PASS")
                .map((rule) => (
                  <IssueCard key={rule.message} rule={rule} current="g" locale={locale} />
                ))}
            </ul>
          )}
          {rules.some((r) => r.outcome === "PASS") && (
            <ul className="grid grid-cols-1 gap-2 @md/form:grid-cols-2 @3xl/form:grid-cols-3">
              {rules
                .filter((r) => r.outcome === "PASS")
                .map((rule) => (
                  <MetTile key={rule.message} rule={rule} locale={locale} />
                ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("reusedEmpty")}</p>
      )}
    </FieldGroup>
  );
}

function G1() {
  const t = useTranslations("wizard.g");
  return (
    <div className="flex flex-col gap-8">
      <Reused ids={["BR-001", "BR-010", "BR-030", "BR-035"]} />
      <FieldGroup title={t("g1.title")}>
        <RuleDigest
          namespace="wizard.g.g1.digest"
          can={[
            { icon: Handshake, key: "refer" },
            { icon: UserCheck, key: "supervised" },
            { icon: Eye, key: "disclose" },
            { icon: Wallet, key: "fees" },
          ]}
          cannot={[
            { icon: MessageSquare, key: "negotiate" },
            { icon: Home, key: "market" },
            { icon: Money, key: "money" },
            { icon: Signature, key: "sign" },
          ]}
          fullText={t("g1.article10")}
        />
        <AckField section="g" path="article10Ack" label={t("g1.ack")} />
      </FieldGroup>
      <StepDocuments step="g" />
    </div>
  );
}

function G2() {
  const t = useTranslations("wizard.g");
  return (
    <div className="flex flex-col gap-8">
      <Reused ids={["BR-001", "BR-010", "BR-015", "BR-030"]} />
      <Territory />
      <FieldGroup title={t("g2.restrictionsTitle")}>
        <RuleDigest
          namespace="wizard.g.g2.digest"
          can={[
            { icon: Home, key: "show" },
            { icon: ClipboardCheck, key: "collect" },
            { icon: Users, key: "assist" },
          ]}
          cannot={[
            { icon: MessageSquare, key: "negotiate" },
            { icon: Signature, key: "sign" },
          ]}
          fullText={t("g2.restrictions")}
        />
        <AckField section="g" path="restrictionsAck" label={t("g2.ack")} />
      </FieldGroup>
      <StepDocuments step="g" />
    </div>
  );
}

/** FR-G2-005: proposed territory as district chips grouped by province (feeds M.8 scope). */
function Territory() {
  const t = useTranslations("wizard.g.g2");
  const translate = useErrorMessage();
  const { provinces } = useWizard();
  const s = useSection("g");
  const [districts, setDistricts] = useState<Record<string, Division[]>>({});
  const selected = new Set(s.data.territory ?? []);

  useEffect(() => {
    let cancelled = false;
    Promise.all(provinces.map(async (p) => [p.code, await loadDivisions(p.code)] as const)).then(
      (entries) => {
        if (!cancelled) setDistricts(Object.fromEntries(entries));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [provinces]);

  const toggle = (code: string) => {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    s.set("territory", [...next]);
  };

  return (
    <FieldGroup title={t("territoryTitle")} description={t("territoryHint")}>
      <div className="flex flex-col gap-4">
        {provinces.map((province) => (
          <fieldset key={province.code} className="flex flex-col gap-2" disabled={s.disabled}>
            <legend className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">
              <MapPin className="size-3.5" aria-hidden /> {province.name}
            </legend>
            <div className="flex flex-wrap gap-2">
              {(districts[province.code] ?? []).map((d) => (
                <button
                  key={d.code}
                  type="button"
                  aria-pressed={selected.has(d.code)}
                  onClick={() => toggle(d.code)}
                  className={chipClassName(selected.has(d.code))}
                >
                  {selected.has(d.code) && <Check aria-hidden />}
                  {d.name}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      {s.error("territory") && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {translate(s.error("territory"))}
        </p>
      )}
    </FieldGroup>
  );
}

function G34() {
  const t = useTranslations("wizard.g");
  const { application } = useWizard();
  const rea = application.category === "REA";
  return (
    <div className="flex flex-col gap-8">
      <Reused
        ids={
          rea
            ? ["BR-001", "BR-011", "BR-013", "BR-012", "BR-015", "BR-016", "BR-020", "BR-030"]
            : ["BR-001", "BR-014", "BR-012", "BR-015", "BR-016", "BR-021", "BR-036"]
        }
      />
      <AckField
        section="g"
        path="dataConfirmed"
        label={t("confirmData")}
        description={t("confirmDataHint")}
      />
      <StepDocuments step="g" />
    </div>
  );
}

function G5() {
  const t = useTranslations("wizard.g");
  return (
    <div className="flex flex-col gap-8">
      <Reused ids={["BR-031", "BR-035"]} />
      <LicenceLookup
        section="g"
        path="brokerLicenceNo"
        label={t("brokerLicence")}
        description={t("brokerLicenceHint")}
        allowed={["BROKER"]}
      />
      <FieldGroup title={t("g5.title")}>
        <RuleDigest
          namespace="wizard.g.g5.digest"
          can={[
            { icon: UserCheck, key: "supervised" },
            { icon: ShieldCheck, key: "answerable" },
          ]}
          fullText={t("g5.text")}
        />
        <AckField section="g" path="supervisionAck" label={t("g5.ack")} />
      </FieldGroup>
      <StepDocuments step="g" />
    </div>
  );
}

function G6() {
  const t = useTranslations("wizard.g");
  const translate = useErrorMessage();
  const s = useSection("g");
  const functions = new Set(s.data.supervisoryFunctions ?? []);
  return (
    <div className="flex flex-col gap-8">
      <Reused ids={["BR-031", "BR-033", "BR-035"]} />
      <LicenceLookup
        section="g"
        path="brokerLicenceNo"
        label={t("brokerLicence")}
        description={t("brokerLicenceHint")}
        allowed={["BROKER"]}
      />
      <FieldGroup title={t("g6.title")} description={t("g6.hint")}>
        <NumberField
          section="g"
          path="supervisedCount"
          label={t("g6.count")}
          min={0}
          max={1000}
          className="max-w-xs"
        />
        <fieldset className="flex flex-col gap-2" disabled={s.disabled}>
          <legend className="mb-2 text-sm font-medium">{t("g6.functions")}</legend>
          <div className="flex flex-wrap gap-2">
            {SUPERVISORY_FUNCTIONS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={functions.has(f)}
                className={chipClassName(functions.has(f))}
                onClick={() => {
                  const next = new Set(functions);
                  if (next.has(f)) next.delete(f);
                  else next.add(f);
                  s.set("supervisoryFunctions", [...next]);
                }}
              >
                {functions.has(f) && <Check aria-hidden />}
                {t(`g6.functionNames.${f}`)}
              </button>
            ))}
          </div>
          {s.error("supervisoryFunctions") && (
            <p role="alert" className="text-xs font-medium text-destructive">
              {translate(s.error("supervisoryFunctions"))}
            </p>
          )}
        </fieldset>
        <TextField
          section="g"
          path="supervisoryNotes"
          label={t("g6.notes")}
          optional
          multiline
          maxLength={2000}
        />
      </FieldGroup>
      <StepDocuments step="g" />
    </div>
  );
}

function Indemnity() {
  const t = useTranslations("wizard.g.indemnity");
  const { sectionContext } = useWizard();
  if (sectionContext.flags?.indemnityRequired === false) return null;
  return (
    <FieldGroup title={t("title")} description={t("hint")}>
      <Grid>
        <TextField section="g" path="indemnity.insurer" label={t("insurer")} maxLength={200} />
        <TextField section="g" path="indemnity.policyNo" label={t("policyNo")} maxLength={60} />
        <NumberField section="g" path="indemnity.cover" label={t("cover")} min={0} />
        <div className="hidden sm:block" />
        <DateField section="g" path="indemnity.from" label={t("from")} />
        <DateField section="g" path="indemnity.to" label={t("to")} min={sectionContext.today} />
      </Grid>
    </FieldGroup>
  );
}

function G7() {
  const t = useTranslations("wizard.g");
  const translate = useErrorMessage();
  const s = useSection("g");
  const accepted = new Set(s.data.responsibilities ?? []);
  return (
    <div className="flex flex-col gap-8">
      <Reused ids={["BR-031", "BR-070"]} />
      <LicenceLookup
        section="g"
        path="brokerLicenceNo"
        label={t("brokerLicence")}
        description={t("brokerLicenceHint")}
        allowed={["BROKER"]}
      />
      <TextField
        section="g"
        path="proposedFirmRef"
        label={t("g7.firmRef")}
        description={t("g7.firmRefHint")}
        maxLength={80}
      />
      <Indemnity />
      <fieldset className="flex flex-col gap-3" disabled={s.disabled}>
        <legend className="mb-1 text-base font-semibold">{t("g7.responsibilitiesTitle")}</legend>
        <p className="text-sm text-muted-foreground">{t("g7.responsibilitiesHint")}</p>
        {PRINCIPAL_RESPONSIBILITIES.map((r) => (
          <label
            key={r}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-2xl p-4",
              INTERACTIVE,
              accepted.has(r) ? SELECTED : cn(SURFACE_MUTED, HOVER),
            )}
          >
            <Checkbox
              checked={accepted.has(r)}
              disabled={s.disabled}
              onCheckedChange={(v) => {
                const next = new Set(accepted);
                if (v === true) next.add(r);
                else next.delete(r);
                s.set("responsibilities", [...next]);
              }}
              className="mt-0.5"
            />
            <span className="text-sm leading-snug">{t(`g7.responsibilities.${r}`)}</span>
          </label>
        ))}
        {s.error("responsibilities") && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {translate(s.error("responsibilities"))}
          </p>
        )}
      </fieldset>
      <StepDocuments step="g" />
    </div>
  );
}

/** G8 — the firm itself (FR-G8-001…013): corporate identity, people, Principal Broker, branches. */
function G8() {
  const t = useTranslations("wizard.g.g8");
  const { sectionContext, locale } = useWizard();
  const s = useSection("g");
  const people = s.data.responsiblePersons ?? [];
  const branches = s.data.branches ?? [];
  const countries = countryOptions(locale).map((c) => ({ value: c.code, label: c.name }));

  return (
    <div className="flex flex-col gap-8">
      <FieldGroup title={t("identityTitle")}>
        <Grid>
          <TextField section="g" path="legalName" label={t("legalName")} maxLength={200} />
          <TextField
            section="g"
            path="tradingName"
            label={t("tradingName")}
            optional
            maxLength={200}
          />
          <SelectField
            section="g"
            path="legalForm"
            label={t("legalForm")}
            options={LEGAL_FORMS.map((f) => ({ value: f, label: t(`legalForms.${f}`) }))}
          />
          <TextField section="g" path="companyRegNo" label={t("companyRegNo")} maxLength={40} />
          <TextField
            section="g"
            path="tin"
            label={t("tin")}
            optional
            maxLength={20}
            inputMode="numeric"
          />
          <DateField
            section="g"
            path="incorporatedOn"
            label={t("incorporatedOn")}
            max={sectionContext.today}
          />
          <TextField section="g" path="phone" label={t("phone")} type="tel" maxLength={20} />
          <TextField section="g" path="email" label={t("email")} type="email" maxLength={254} />
        </Grid>
      </FieldGroup>

      <AddressField
        section="g"
        path="registeredOffice"
        legend={t("registeredOffice")}
        allowAbroad={false}
      />
      <YesNoField section="g" path="placeSameAsOffice" label={t("sameAsOffice")} />
      {s.data.placeSameAsOffice === false && (
        <AddressField
          section="g"
          path="principalPlace"
          legend={t("principalPlace")}
          allowAbroad={false}
        />
      )}

      <FieldGroup title={t("peopleTitle")} description={t("peopleHint")}>
        <ItemList
          section="g"
          path="responsiblePersons"
          items={people}
          icon={UserRound}
          max={30}
          template={() =>
            ({ id: newId(), nationality: "RW", idType: "NATIONAL_ID" }) as (typeof people)[number]
          }
          title={(person, index) => person.name || t("personN", { n: index + 1 })}
          meta={(person) =>
            [person.role, person.idNumber].filter(Boolean).join(" · ") || t("personEmpty")
          }
          labels={{
            add: t("addPerson"),
            empty: t("peopleEmpty"),
            newTitle: t("newPerson"),
            remove: (n) => t("removePerson", { n }),
          }}
          fields={(person, index) => (
            <>
              <Grid>
                <TextField
                  section="g"
                  path={`responsiblePersons.${index}.name`}
                  label={t("personName")}
                  maxLength={200}
                />
                <TextField
                  section="g"
                  path={`responsiblePersons.${index}.role`}
                  label={t("personRole")}
                  maxLength={80}
                />
                <SelectField
                  section="g"
                  path={`responsiblePersons.${index}.idType`}
                  label={t("idType")}
                  options={ID_TYPES.map((v) => ({ value: v, label: t(`idTypes.${v}`) }))}
                />
                <TextField
                  section="g"
                  path={`responsiblePersons.${index}.idNumber`}
                  label={t("idNumber")}
                  maxLength={30}
                />
                <SelectField
                  section="g"
                  path={`responsiblePersons.${index}.nationality`}
                  label={t("nationality")}
                  options={countries}
                />
                <NumberField
                  section="g"
                  path={`responsiblePersons.${index}.shareholding`}
                  label={t("shareholding")}
                  optional
                  min={0}
                  max={100}
                />
              </Grid>
            </>
          )}
        />
      </FieldGroup>

      <FieldGroup title={t("principalTitle")} description={t("principalHint")}>
        <LicenceLookup
          section="g"
          path="principalBrokerLicenceNo"
          label={t("principalLicence")}
          allowed={["PRINCIPAL_BROKER", "BROKER"]}
        />
      </FieldGroup>

      <FieldGroup title={t("branchesTitle")} description={t("branchesHint")}>
        <ItemList
          section="g"
          path="branches"
          items={branches}
          icon={Building2}
          max={30}
          template={() => ({ id: newId() }) as (typeof branches)[number]}
          title={(branch, index) => branch.name || t("branchN", { n: index + 1 })}
          meta={(branch) =>
            [branch.phone, branch.managingBrokerLicenceNo].filter(Boolean).join(" · ") ||
            t("branchEmpty")
          }
          labels={{
            add: t("addBranch"),
            empty: t("branchesEmpty"),
            newTitle: t("newBranch"),
            remove: (n) => t("removeBranch", { n }),
          }}
          fields={(branch, index) => (
            <>
              <Grid>
                <TextField
                  section="g"
                  path={`branches.${index}.name`}
                  label={t("branchName")}
                  maxLength={120}
                />
                <TextField
                  section="g"
                  path={`branches.${index}.phone`}
                  label={t("branchPhone")}
                  optional
                  type="tel"
                  maxLength={20}
                />
                <TextField
                  section="g"
                  path={`branches.${index}.managingBrokerLicenceNo`}
                  label={t("branchManager")}
                  optional
                  maxLength={40}
                />
                <DateField
                  section="g"
                  path={`branches.${index}.openingDate`}
                  label={t("openingDate")}
                  optional
                />
              </Grid>
              <AddressField
                section="g"
                path={`branches.${index}.address`}
                legend={t("branchAddress")}
                allowAbroad={false}
              />
            </>
          )}
        />
      </FieldGroup>

      <Indemnity />

      <FieldGroup title={t("systemsTitle")}>
        <YesNoField
          section="g"
          path="clientFundsApplicable"
          label={t("clientFunds")}
          description={t("clientFundsHint")}
        />
        <AckField
          section="g"
          path="hasSupervisoryManual"
          label={t("manual")}
          description={t("manualHint")}
        />
      </FieldGroup>

      <StepDocuments step="g" />
    </div>
  );
}
