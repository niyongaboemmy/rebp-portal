"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  buildChecklist,
  checkSection,
  DECLARATION_STATEMENTS,
  isRequiredForSubmission,
  isSatisfied,
  sectionsFor,
  type SectionKey,
  type StepKey,
} from "@rebp/contracts";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  CircleCheck,
  FileText,
  ListChecks,
  Mail,
  PenLine,
  Signature,
  Smartphone,
  Wallet,
} from "@/components/icons";
import { DevCode } from "@/components/auth/dev-code";
import { ApplicationSummary } from "@/components/applications/application-summary";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldControl } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import { useErrorMessage } from "@/hooks/use-error-message";
import { formatMoney } from "@/lib/format";
import { HOVER, INTERACTIVE, SELECTED, SURFACE_MUTED } from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import { requestSignatureAction, signAndSubmitAction } from "@/server/actions/applications";
import { useWizard } from "./context";
import { IssueCard } from "./issue-card";

/**
 * Review, declaration and e-signature (FR-WIZ-008, FR-WIZ-013, FR-J-001…007, FR-PAY-002):
 * everything entered, grouped by section with edit links; what still blocks submission; the fee
 * breakdown; the eight declaration statements; then an OTP sent to the verified email or phone
 * signs a SHA-256 snapshot of the application.
 */
export function StepReview({ goTo }: { goTo: (step: StepKey) => void }) {
  const t = useTranslations("wizard.review");
  const td = useTranslations("wizard.declaration");
  const tp = useTranslations("payment.lines");
  const ts = useTranslations("wizard.steps");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const wizard = useWizard();
  const {
    application,
    data,
    documents,
    eligibility,
    fee,
    locale,
    sectionContext,
    flush,
    divisionNames,
  } = wizard;
  const [confirmed, setConfirmed] = useState(false);
  const [capacity, setCapacity] = useState("");
  const [method, setMethod] = useState<"EMAIL" | "SMS">("EMAIL");
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();
  const [feesOpen, setFeesOpen] = useState(false);
  const firm = application.category === "REBF";
  const resubmission = application.status === "ACTION_REQUIRED";

  const sections = sectionsFor(application.type, application.category);
  const incomplete = sections.filter(
    (key) => Object.keys(checkSection(key, data, sectionContext)).length > 0,
  );
  const checklist = buildChecklist({
    type: application.type,
    category: application.category,
    data,
  });
  const missing = checklist.filter(
    (item) =>
      isRequiredForSubmission(item) &&
      !isSatisfied(documents.filter((d) => d.type === item.type).map((d) => d.status)),
  );
  const blocking = eligibility.rules.filter((r) => r.outcome === "FAIL");
  const ready = incomplete.length === 0 && missing.length === 0 && blocking.length === 0;

  const sendCode = () =>
    startTransition(async () => {
      await flush();
      const result = await requestSignatureAction({
        applicationId: application.id,
        confirmed: true,
        capacity: capacity || undefined,
        method,
      });
      if (!result.ok) {
        toast.error(errorMessage(result.error, result.meta));
        return;
      }
      setSent(true);
      setDevCode(result.data.devCode);
      toast.success(td(method === "SMS" ? "sentSms" : "sentEmail"));
    });

  const sign = () =>
    startTransition(async () => {
      const result = await signAndSubmitAction({
        applicationId: application.id,
        code,
        method,
        capacity: capacity || undefined,
      });
      if (!result.ok) {
        toast.error(errorMessage(result.error, result.meta));
        return;
      }
      toast.success(resubmission ? td("resubmitted") : td("signed"));
      // Signed: on to payment, or (nothing to pay) straight to the celebration.
      router.push(
        !resubmission && fee.total > 0
          ? `/applications/${application.id}/pay`
          : `/applications/${application.id}?celebrate=1`,
      );
    });

  return (
    <div className="flex flex-col gap-8">
      {/* The way to a signed application, as three steps that light up (UX-027). */}
      <SignPath ready={ready} confirmed={confirmed} sent={sent} />

      {/* What still blocks submission (FR-WIZ-013). */}
      {ready ? null : (
        <section
          id="blockers-box"
          aria-labelledby="blockers"
          className="flex flex-col gap-3 rounded-2xl bg-primary-soft p-4 sm:p-5"
        >
          <h3 id="blockers" className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4 text-link" aria-hidden /> {t("notReady")}
          </h3>
          <p className="-mt-1 text-sm text-muted-foreground">{t("notReadyHint")}</p>
          <ul className="flex flex-col gap-2 text-sm">
            {incomplete.map((key: SectionKey) => (
              <li key={key}>
                <BlockerRow
                  text={t("sectionIncomplete", { section: ts(`${key}.title`) })}
                  cta={t("goFix")}
                  onClick={() => goTo(key)}
                />
              </li>
            ))}
            {missing.length > 0 && (
              <li>
                <BlockerRow
                  text={t("documentsMissing", { count: missing.length })}
                  cta={t("goUpload")}
                  onClick={() => goTo("i")}
                />
              </li>
            )}
            {blocking.length > 0 && (
              <li className="flex flex-col gap-2">
                <span className="font-medium">{t("ineligible", { count: blocking.length })}</span>
                <ul className="flex flex-col gap-2">
                  {blocking.map((rule) => (
                    <IssueCard
                      key={`${rule.id}-${rule.message}`}
                      rule={rule}
                      current="review"
                      locale={locale}
                    />
                  ))}
                </ul>
              </li>
            )}
          </ul>
        </section>
      )}

      <div id="review-answers" className="scroll-mt-28">
        <ApplicationSummary
          collapsible
          type={application.type}
          category={application.category}
          data={data}
          locale={locale}
          divisions={divisionNames}
          editHref={
            application.status === "DRAFT" || resubmission
              ? (step) => `/applications/${application.id}/wizard?step=${step}`
              : undefined
          }
        />
      </div>

      {!resubmission && fee.total > 0 && (
        <section
          aria-labelledby="fees"
          className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.06] dark:bg-surface-2/70 dark:ring-white/[0.06]"
        >
          <button
            type="button"
            onClick={() => setFeesOpen((o) => !o)}
            aria-expanded={feesOpen}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-primary/[0.03] dark:hover:bg-white/[0.03]"
          >
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-link">
              <Wallet className="size-[1.1rem]" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <h3 id="fees" className="text-sm font-semibold">
                {t("feesTitle")}
              </h3>
              <span className="text-xs text-muted-foreground">{t("feesWhen")}</span>
            </span>
            <span className="text-base font-bold num">
              {formatMoney(fee.total, fee.currency, locale)}
            </span>
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                feesOpen && "rotate-180",
              )}
              aria-hidden
            />
          </button>
          {feesOpen && (
            <dl className="flex animate-rise flex-col divide-y divide-foreground/[0.06] border-t border-foreground/[0.06] text-sm [animation-duration:var(--dur-2)] dark:divide-white/[0.06] dark:border-white/[0.06]">
              {fee.lines.map((line) => (
                <div key={line.code} className="flex justify-between gap-4 px-4 py-2.5">
                  <dt className="text-muted-foreground">{tp(line.code)}</dt>
                  <dd className="font-medium num">
                    {formatMoney(line.amount, fee.currency, locale)}
                  </dd>
                </div>
              ))}
              {fee.sample && (
                <p className="px-4 py-2.5 text-xs text-muted-foreground">{t("sampleFees")}</p>
              )}
            </dl>
          )}
        </section>
      )}

      {/* Section J — declaration (FR-J-001/002) and signature (FR-J-003…005). */}
      <section
        id="review-declaration"
        aria-labelledby="declaration"
        className="flex scroll-mt-28 flex-col gap-4"
      >
        <h3 id="declaration" className="text-base font-semibold">
          {td("title")}
        </h3>
        <ol
          tabIndex={0}
          aria-labelledby="declaration"
          className="flex max-h-60 list-decimal flex-col gap-2 overflow-y-auto rounded-2xl bg-card [mask-image:linear-gradient(to_bottom,black_85%,transparent)] py-4 pr-4 pl-9 text-sm leading-relaxed ring-1 ring-foreground/[0.06] outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:bg-surface-2/70 dark:ring-white/[0.06]"
        >
          {Array.from({ length: DECLARATION_STATEMENTS }, (_, i) => (
            <li key={i}>{td(`statements.${i + 1}`)}</li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">
          {td.rich("privacy", {
            link: (chunks) => (
              <a
                href="/privacy"
                target="_blank"
                className="font-medium text-link underline-offset-4 hover:underline"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
        <label
          id="confirm-box"
          className={cn(
            "flex cursor-pointer scroll-mt-28 items-start gap-3 rounded-2xl p-4",
            INTERACTIVE,
            confirmed ? SELECTED : cn(SURFACE_MUTED, HOVER),
          )}
        >
          <Checkbox
            checked={confirmed}
            onCheckedChange={(v) => setConfirmed(v === true)}
            disabled={!ready || sent}
            className="mt-0.5"
          />
          <span className="text-sm font-medium">{td("confirm")}</span>
        </label>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1 rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.06] dark:bg-surface-2/70 dark:ring-white/[0.06]">
            <dt className="text-xs text-muted-foreground">{td("signatory")}</dt>
            <dd className="font-semibold">{wizard.signatoryName}</dd>
          </div>
          {firm && (
            <Field id="capacity-box" label={td("capacity")} description={td("capacityHint")}>
              <FieldControl>
                <Input
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  maxLength={80}
                  disabled={sent}
                  placeholder={td("capacityPlaceholder")}
                />
              </FieldControl>
            </Field>
          )}
        </dl>

        <span id="review-sign" className="scroll-mt-28" />
        {!sent ? (
          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium">{td("method")}</span>
            <div
              className="grid gap-2.5 sm:grid-cols-2"
              role="radiogroup"
              aria-label={td("method")}
            >
              {(["EMAIL", "SMS"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={method === m}
                  disabled={m === "SMS" && !wizard.phone}
                  onClick={() => setMethod(m)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl p-4 text-left disabled:opacity-50",
                    INTERACTIVE,
                    method === m ? SELECTED : cn(SURFACE_MUTED, HOVER),
                  )}
                >
                  {m === "EMAIL" ? (
                    <Mail className="size-5 text-link" aria-hidden />
                  ) : (
                    <Smartphone className="size-5 text-link" aria-hidden />
                  )}
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold">
                      {td(m === "EMAIL" ? "byEmail" : "bySms")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {m === "EMAIL" ? wizard.email : wizard.phone}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <Button
              type="button"
              size="lg"
              onClick={() => {
                // Not ready yet: take the applicant to what is missing instead of doing nothing.
                if (!ready) return pointTo("blockers-box");
                if (!confirmed) return pointTo("confirm-box");
                if (firm && capacity.trim().length < 2) return pointTo("capacity-box");
                sendCode();
              }}
              loading={pending}
              className={cn(
                "self-start",
                (!ready || !confirmed || (firm && capacity.trim().length < 2)) &&
                  "bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft dark:bg-surface-3 dark:text-foreground",
              )}
            >
              <Signature aria-hidden /> {td("sendCode")}
            </Button>
          </div>
        ) : (
          <div className={cn("flex flex-col gap-4 rounded-2xl p-4 sm:p-5", SELECTED)}>
            <p className="flex items-center gap-2 text-sm font-medium">
              <CircleCheck className="size-4 text-link" aria-hidden />
              {td(method === "SMS" ? "codeSentSms" : "codeSentEmail", {
                destination: method === "SMS" ? (wizard.phone ?? "") : wizard.email,
              })}
            </p>
            <DevCode code={devCode} onUse={setCode} />
            <Field label={td("code")}>
              <FieldControl>
                <OtpInput
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="max-w-56"
                />
              </FieldControl>
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="lg"
                onClick={sign}
                loading={pending}
                disabled={code.length !== 6}
              >
                <PenLine aria-hidden /> {resubmission ? td("resubmit") : td("signSubmit")}{" "}
                <ArrowRight aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSent(false);
                  setCode("");
                }}
              >
                {td("changeMethod")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{td("legal")}</p>
          </div>
        )}
      </section>
    </div>
  );
}

/** One thing still missing, with a button straight to where it is fixed. */
function BlockerRow({ text, cta, onClick }: { text: string; cta: string; onClick: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-card/70 p-3 dark:bg-surface-2">
      <span className="font-medium">{text}</span>
      <button
        type="button"
        onClick={onClick}
        className="group inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--primary)_86%,black)]"
      >
        {cta}
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </button>
    </div>
  );
}

/** Scrolls to a block and pulses it, so a blocked action shows what is missing. */
function pointTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.animate(
    [
      { boxShadow: "0 0 0 0 transparent" },
      { boxShadow: "0 0 0 6px color-mix(in oklch, var(--warning) 35%, transparent)" },
      { boxShadow: "0 0 0 0 transparent" },
    ],
    { duration: 1100, easing: "ease-out" },
  );
}

/**
 * The way to a signed application (UX-027): check the answers, accept the declaration, sign with
 * a code — three nodes on a line, each lit as it's done, the current one ringed; each a way to its
 * part of the page. The words stay short: the picture says where the applicant is.
 */
function SignPath({
  ready,
  confirmed,
  sent,
}: {
  ready: boolean;
  confirmed: boolean;
  sent: boolean;
}) {
  const t = useTranslations("wizard.review.path");
  const tr = useTranslations("wizard.review");
  const steps = [
    {
      key: "check",
      icon: ListChecks,
      target: ready ? "review-answers" : "blockers-box",
      state: ready ? "done" : "fix",
    },
    {
      key: "accept",
      icon: FileText,
      target: "review-declaration",
      state: confirmed ? "done" : ready ? "now" : "todo",
    },
    {
      key: "sign",
      icon: Signature,
      target: "review-sign",
      state: confirmed ? (sent ? "sent" : "now") : "todo",
    },
  ] as const;
  return (
    <section
      aria-labelledby="sign-path"
      className="flex flex-col gap-4 rounded-2xl bg-[linear-gradient(160deg,color-mix(in_oklch,var(--primary)_7%,var(--card)),var(--card)_70%)] p-4 ring-1 ring-primary/10 sm:p-5 dark:bg-surface-2/70 dark:ring-white/[0.06]"
    >
      <div className="flex flex-col">
        <h3 id="sign-path" className="font-semibold">
          {ready ? tr("readyTitle") : tr("notReady")}
        </h3>
        <p className="text-xs text-muted-foreground">{ready ? t("readyHint") : t("fixHint")}</p>
      </div>
      <ol className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-start gap-x-1.5">
        {steps.map(({ key, icon: Icon, target, state }, i) => (
          <li key={key} className="contents">
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById(target)
                  ?.scrollIntoView({ block: "start", behavior: "smooth" })
              }
              aria-label={`${t(`steps.${key}`)}: ${t(`states.${state}`)}`}
              className="group/node flex w-20 flex-col items-center gap-1.5 rounded-2xl p-1 text-center outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 sm:w-28"
            >
              <span
                className={cn(
                  "relative inline-flex size-11 items-center justify-center rounded-full transition-[background-color,transform] duration-(--dur-3) group-hover/node:scale-105",
                  state === "done" && "bg-primary-soft text-link",
                  (state === "now" || state === "sent") &&
                    "bg-primary text-primary-foreground shadow-[0_8px_20px_-10px_var(--primary)]",
                  state === "fix" && "bg-danger-soft text-destructive",
                  state === "todo" &&
                    "border border-dashed border-foreground/20 bg-card text-muted-foreground dark:bg-surface-2",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {state === "done" && (
                  <span className="absolute -right-0.5 -bottom-0.5 inline-flex size-4 items-center justify-center rounded-full bg-card text-link ring-1 ring-primary/40">
                    <Check className="size-2.5" strokeWidth={2.5} aria-hidden />
                  </span>
                )}
              </span>
              <span className="text-xs leading-tight font-semibold">{t(`steps.${key}`)}</span>
              <span
                className={cn(
                  "text-[0.65rem] font-semibold",
                  state === "fix"
                    ? "text-destructive"
                    : state === "todo"
                      ? "text-muted-foreground"
                      : "text-link",
                )}
              >
                {t(`states.${state}`)}
              </span>
            </button>
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "mt-[1.6rem] h-0.5 rounded-full transition-colors duration-(--dur-3)",
                  state === "done" ? "bg-primary" : "bg-foreground/[0.1] dark:bg-white/[0.12]",
                )}
              />
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
