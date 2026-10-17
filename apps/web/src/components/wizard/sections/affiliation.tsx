"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { normaliseLicenceNo, SUPERVISOR_CATEGORIES } from "@rebp/contracts";
import { Building2, Handshake, Scale, Users } from "@/components/icons";
import { SupervisionChain, type LinkState } from "@/components/graphics/supervision-chain";
import { Alert } from "@/components/ui/alert";
import { Field, FieldControl } from "@/components/ui/field";
import { useSection, useWizard } from "../context";
import {
  ChoiceCards,
  DateField,
  FieldGroup,
  Grid,
  NativeSelect,
  TextField,
  YesNoField,
} from "../fields";
import { FirmLookup, isWholeLicenceNo, LicenceLookup } from "../lookups";
import { focusField } from "../focus";
import { FieldRules } from "../rules-ui";
import { StepDocuments } from "../step-documents";

/**
 * Section F — firm affiliation and supervision (FR-F-001…009, Appendix A.6). The questions adapt to
 * the category: RERA chooses a firm or an approved referral arrangement (F.12–14); Brokers choose a
 * practice arrangement (G4.5 → F.15–16); Associate and Managing Brokers name a registered firm, and
 * Managing Brokers the branch they will run (BR-033).
 */
export function SectionAffiliation() {
  const t = useTranslations("wizard.f");
  const { application, sectionContext, firm, eligibility } = useWizard();
  const s = useSection("f");
  const category = application.category;
  const supervisorAllowed = SUPERVISOR_CATEGORIES[category];
  const maxStart = new Date(Date.parse(sectionContext.today) + 30 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const needsFirm =
    category === "RERA"
      ? s.data.reraMode === "FIRM"
      : category === "BROKER"
        ? s.data.practiceArrangement === "AFFILIATED"
        : true;
  const designation = category === "ASSOCIATE_BROKER" || category === "MANAGING_BROKER";
  const showFirm =
    needsFirm &&
    (category !== "BROKER" || s.data.practiceArrangement === "AFFILIATED") &&
    (category !== "RERA" || s.data.reraMode === "FIRM");
  const firmName = s.data.firmId && firm ? (firm.tradingName ?? firm.legalName) : s.data.firmName;
  const freeBranches = firm?.branches.filter((b) => !b.hasManager) ?? [];

  // The picture of this page's answers (UX-004 Phase 4), from the same rules the form shows.
  const referral = category === "RERA" && s.data.reraMode === "REFERRAL";
  const ruleState = (id: string, answered: boolean, current?: string): LinkState => {
    const rule = eligibility.rules.find((r) => r.id === id);
    if (!answered) return "empty";
    // A result about an earlier answer is stale until the next autosave runs the rules.
    if (!rule || (current && rule.values?.licence && rule.values.licence !== current))
      return "checking";
    if (rule.outcome === "PASS") return "ok";
    if (rule.outcome === "FAIL") return "fail";
    return "officer";
  };
  const throughState = referral
    ? s.data.referralApprovalRef
      ? "officer"
      : "empty"
    : ruleState("BR-035", Boolean(firmName));
  const supervisorState = ruleState(
    "BR-030",
    Boolean(s.data.supervisorLicenceNo),
    s.data.supervisorLicenceNo,
  );

  // Sensible defaults the applicant can change (UX-004 Phase 3): affiliation starts today, and a
  // Managing Broker's branch is the only one without a manager. Written to the answers, so they
  // save and show like any other answer.
  const { set, disabled } = s;
  const startMissing = showFirm && !s.data.affiliationStart;
  const onlyBranch =
    category === "MANAGING_BROKER" && !s.data.branchId && freeBranches.length === 1
      ? freeBranches[0]!.id
      : undefined;
  useEffect(() => {
    if (disabled) return;
    if (startMissing) set("affiliationStart", sectionContext.today);
    if (onlyBranch) set("branchId", onlyBranch);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when a default becomes due
  }, [startMissing, onlyBranch, disabled]);

  return (
    <div className="flex flex-col gap-8">
      {category === "RERA" && (
        <ChoiceCards
          section="f"
          path="reraMode"
          label={t("reraMode")}
          options={[
            {
              value: "FIRM",
              label: t("reraFirm"),
              description: t("reraFirmHint"),
              icon: <Building2 className="size-4" />,
            },
            {
              value: "REFERRAL",
              label: t("reraReferral"),
              description: t("reraReferralHint"),
              icon: <Handshake className="size-4" />,
            },
          ]}
        />
      )}
      {category === "BROKER" && (
        <ChoiceCards
          section="f"
          path="practiceArrangement"
          label={t("arrangement")}
          columns={3}
          options={[
            {
              value: "AFFILIATED",
              label: t("arrangements.AFFILIATED"),
              description: t("arrangementHints.AFFILIATED"),
              icon: <Building2 className="size-4" />,
            },
            {
              value: "INDEPENDENT",
              label: t("arrangements.INDEPENDENT"),
              description: t("arrangementHints.INDEPENDENT"),
              icon: <Scale className="size-4" />,
            },
            {
              value: "ESTABLISH_OR_JOIN_REBF",
              label: t("arrangements.ESTABLISH_OR_JOIN_REBF"),
              description: t("arrangementHints.ESTABLISH_OR_JOIN_REBF"),
              icon: <Users className="size-4" />,
            },
          ]}
        />
      )}

      {showFirm && (
        <FieldGroup
          title={t("firmTitle")}
          description={designation ? t("designationHint") : t("firmHint")}
        >
          <FirmLookup
            section="f"
            idPath="firmId"
            namePath={designation ? undefined : "firmName"}
            allowManual={!designation}
            label={t("firm")}
          />
          {/* Short answers side by side (UX-005); stacked when the card is narrow. */}
          <Grid>
            {/* Asked once the firm is known, in its name (FR-F-001). */}
            {!designation && firmName && (
              <YesNoField
                section="f"
                path="isAffiliated"
                label={t("isAffiliatedWith", { firm: firmName })}
                description={
                  s.data.isAffiliated === false ? t("proposedNote", { firm: firmName }) : undefined
                }
              />
            )}
            {category === "MANAGING_BROKER" && firm && (
              <div className="flex flex-col gap-2">
                <Field
                  label={t("branch")}
                  description={t("branchHint")}
                  error={s.error("branchId")}
                  data-path="branchId"
                >
                  <FieldControl>
                    <NativeSelect
                      value={s.data.branchId}
                      onChange={(v) => s.set("branchId", v)}
                      disabled={s.disabled}
                      options={firm.branches.map((b) => ({
                        value: b.id,
                        label: b.hasManager ? `${b.name} — ${t("branchTaken")}` : b.name,
                      }))}
                    />
                  </FieldControl>
                </Field>
                <FieldRules section="f" path="branchId" />
              </div>
            )}
            <DateField
              section="f"
              path="affiliationStart"
              label={t("affiliationStart")}
              description={t("affiliationStartHint")}
              max={maxStart}
            />
          </Grid>
        </FieldGroup>
      )}

      {category === "RERA" && s.data.reraMode === "REFERRAL" && (
        <FieldGroup title={t("referralTitle")}>
          <Grid>
            <TextField
              section="f"
              path="referralArrangementName"
              label={t("referralName")}
              maxLength={200}
            />
            <TextField
              section="f"
              path="referralApprovalRef"
              label={t("referralRef")}
              maxLength={80}
            />
          </Grid>
        </FieldGroup>
      )}

      {category === "BROKER" && s.data.practiceArrangement === "INDEPENDENT" && (
        <FieldGroup title={t("independentTitle")} description={t("independentHint")}>
          <TextField
            section="f"
            path="independentAuthorisationRef"
            label={t("independentRef")}
            maxLength={80}
          />
          <TextField
            section="f"
            path="independentNotes"
            label={t("independentNotes")}
            optional
            multiline
            maxLength={1000}
          />
        </FieldGroup>
      )}
      {category === "BROKER" && s.data.practiceArrangement === "ESTABLISH_OR_JOIN_REBF" && (
        <Alert variant="info" title={t("establishTitle")}>
          {application.accountType === "ORGANISATION" ? t("establishOrg") : t("establishPerson")}
        </Alert>
      )}

      {supervisorAllowed && (
        <FieldGroup title={t("supervisorTitle")} description={t("supervisorHint")}>
          <SupervisionChain
            through={referral ? "referral" : "firm"}
            throughLabel={referral ? s.data.referralArrangementName : firmName}
            throughState={throughState}
            // The supervisor's number once it's whole; "Supervisor" while it's being typed.
            supervisorLabel={
              s.data.supervisorLicenceNo && isWholeLicenceNo(s.data.supervisorLicenceNo)
                ? normaliseLicenceNo(s.data.supervisorLicenceNo)
                : undefined
            }
            supervisorState={supervisorState}
            // Each node goes to its answer: the firm on its page, the supervisor's licence here.
            onThrough={() => focusField(referral ? "referralArrangementName" : "firmId")}
            onSupervisor={() => focusField("supervisorLicenceNo")}
          />
          <LicenceLookup
            section="f"
            path="supervisorLicenceNo"
            label={t("supervisorLicence")}
            allowed={supervisorAllowed}
            // The firm's Principal Broker can always supervise: one tap instead of typing.
            suggestions={firm?.principal ? [firm.principal] : []}
          />
        </FieldGroup>
      )}

      <StepDocuments step="f" />
    </div>
  );
}
