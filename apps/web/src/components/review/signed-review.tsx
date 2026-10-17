import { Lock, Signature } from "@/components/icons";
import { useTranslations } from "next-intl";
import {
  VERIFICATION_ITEMS,
  type StatusTone,
  type VerificationItem,
  type VerificationOutcome,
} from "@rebp/contracts";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AttentionPill, LIST_GROUP, LIST_ROW, Mark, type MarkState } from "./marks";

export interface SignedReviewData {
  version: number;
  officerName: string;
  signedAt: Date;
  checks: Partial<Record<VerificationItem, { outcome: VerificationOutcome; note?: string }>>;
  documentation: string | null;
  documentationOverrideReason: string | null;
  eligibility: string | null;
  eligibilityOverrideReason: string | null;
  computed: {
    documentation?: string;
    eligibility?: string;
    overridden?: { documentation?: boolean; eligibility?: boolean };
  };
  internalComment: string | null;
  applicantComment: string | null;
  recommendation: string | null;
  reasonCodes: string[];
  reasons: string | null;
  legalReference: string | null;
  signature: { method?: string; at?: string } | null;
}

const CHECK_MARK: Record<VerificationOutcome, MarkState> = {
  VERIFIED: "done",
  PENDING: "todo",
  FAILED: "failed",
  NA: "none",
};

export const RECOMMENDATION_TONES: Record<string, StatusTone> = {
  APPROVE: "good",
  REFER: "info",
  REJECT: "critical",
};

/**
 * A signed Section L review (FR-L-010): read-only, with the signature, BR-090 override flags and
 * reasons. Server-compatible; shown in the review console and on the decision screen. Checks read
 * as one list group with soft ticks; overrides carry a Sun dot.
 */
export function SignedReview({
  review,
  locale,
  showInternal = true,
  className,
}: {
  review: SignedReviewData;
  locale: string;
  showInternal?: boolean;
  className?: string;
}) {
  const t = useTranslations("review");
  const overridden = review.computed.overridden ?? {};
  return (
    <article className={cn("flex flex-col gap-5", className)} data-testid="signed-review">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-primary/[0.06] px-4 py-3 text-sm ring-1 ring-primary/20 dark:bg-primary/[0.12]">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-link">
          <Signature className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          {t("signed.by", {
            version: review.version,
            name: review.officerName,
            date: formatDateTime(review.signedAt, locale),
          })}
          {review.signature?.method && (
            <span className="text-muted-foreground">
              {" "}
              · {t(`signed.methods.${review.signature.method}`)}
            </span>
          )}
        </span>
        <Badge variant="neutral">
          <Lock aria-hidden /> {t("signed.readOnly")}
        </Badge>
      </div>

      <dl className={cn(LIST_GROUP, "grid @xl/main:grid-cols-2 @xl/main:divide-y-0")}>
        {VERIFICATION_ITEMS.map((item) => {
          const check = review.checks[item];
          return (
            <div
              key={item}
              className={cn(
                "flex items-start gap-3 @xl/main:border-b @xl/main:border-foreground/[0.06] @xl/main:dark:border-white/[0.06] @xl/main:[&:nth-last-child(-n+2)]:border-b-0",
                LIST_ROW,
              )}
            >
              <Mark state={check ? CHECK_MARK[check.outcome] : "todo"} className="mt-px" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <dt className="text-sm font-semibold">{t(`items.${item}.label`)}</dt>
                <dd className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                  <span
                    className={cn(
                      "font-semibold",
                      check?.outcome === "FAILED" ? "text-destructive" : "text-foreground",
                    )}
                  >
                    {check ? t(`outcomes.${check.outcome}`) : "—"}
                  </span>
                  {check?.note && <span>{check.note}</span>}
                </dd>
              </span>
            </div>
          );
        })}
      </dl>

      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[minmax(9rem,14rem)_1fr]">
        <dt className="text-muted-foreground">{t("form.documentation")}</dt>
        <dd className="flex flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2 font-medium">
            {review.documentation ? t(`documentationOutcomes.${review.documentation}`) : "—"}
            {overridden.documentation && <AttentionPill>{t("signed.overridden")}</AttentionPill>}
          </span>
          {review.documentationOverrideReason && (
            <span className="text-muted-foreground">{review.documentationOverrideReason}</span>
          )}
        </dd>
        <dt className="text-muted-foreground">{t("form.eligibility")}</dt>
        <dd className="flex flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2 font-medium">
            {review.eligibility ? t(`eligibilityOutcomes.${review.eligibility}`) : "—"}
            {overridden.eligibility && <AttentionPill>{t("signed.overridden")}</AttentionPill>}
          </span>
          {review.eligibilityOverrideReason && (
            <span className="text-muted-foreground">{review.eligibilityOverrideReason}</span>
          )}
        </dd>
        <dt className="text-muted-foreground">{t("form.recommendation")}</dt>
        <dd>
          {review.recommendation ? (
            <StatusBadge
              tone={RECOMMENDATION_TONES[review.recommendation] ?? "neutral"}
              label={t(`recommendations.${review.recommendation}.label`)}
              size="lg"
            />
          ) : (
            "—"
          )}
        </dd>
        {review.reasonCodes.length > 0 && (
          <>
            <dt className="text-muted-foreground">{t("form.reasonCodes")}</dt>
            <dd className="flex flex-wrap gap-1.5">
              {review.reasonCodes.map((code) => (
                <Badge key={code} variant="danger">
                  {t(`reasonCodes.${code}`)}
                </Badge>
              ))}
            </dd>
          </>
        )}
        {review.reasons && (
          <>
            <dt className="text-muted-foreground">{t("signed.reasons")}</dt>
            <dd className="whitespace-pre-line">{review.reasons}</dd>
          </>
        )}
        {review.legalReference && (
          <>
            <dt className="text-muted-foreground">{t("form.legalReference")}</dt>
            <dd>{review.legalReference}</dd>
          </>
        )}
        {showInternal && review.internalComment && (
          <>
            <dt className="text-muted-foreground">{t("form.internalComment")}</dt>
            <dd className="whitespace-pre-line">{review.internalComment}</dd>
          </>
        )}
        {review.applicantComment && (
          <>
            <dt className="text-muted-foreground">{t("form.applicantComment")}</dt>
            <dd className="whitespace-pre-line">{review.applicantComment}</dd>
          </>
        )}
      </dl>
    </article>
  );
}

/** Maps a Prisma review row (+ officer) to the view model. */
export function toSignedReview(review: {
  version: number;
  officer: { fullName: string };
  signedAt: Date | null;
  checks: unknown;
  documentation: string | null;
  documentationOverrideReason: string | null;
  eligibility: string | null;
  eligibilityOverrideReason: string | null;
  computed: unknown;
  internalComment: string | null;
  applicantComment: string | null;
  recommendation: string | null;
  reasonCodes: string[];
  reasons: string | null;
  legalReference: string | null;
  signature: unknown;
}): SignedReviewData {
  return {
    ...review,
    officerName: review.officer.fullName,
    signedAt: review.signedAt ?? new Date(0),
    checks: (review.checks ?? {}) as SignedReviewData["checks"],
    computed: (review.computed ?? {}) as SignedReviewData["computed"],
    signature: (review.signature ?? null) as SignedReviewData["signature"],
  };
}
