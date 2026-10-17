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

const OUTCOME_TONE: Record<VerificationOutcome, StatusTone> = {
  VERIFIED: "good",
  PENDING: "info",
  FAILED: "critical",
  NA: "neutral",
};

export const RECOMMENDATION_TONES: Record<string, StatusTone> = {
  APPROVE: "good",
  REFER: "info",
  REJECT: "critical",
};

/**
 * A signed Section L review (FR-L-010): read-only, with the signature, BR-090 override flags and
 * reasons. Server-compatible; shown in the review console and on the decision screen.
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
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-success-soft px-4 py-3 text-sm">
        <Signature className="size-5 shrink-0 text-success" aria-hidden />
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

      <dl className="grid gap-2 sm:grid-cols-2">
        {VERIFICATION_ITEMS.map((item) => {
          const check = review.checks[item];
          return (
            <div key={item} className="flex flex-col gap-1.5 rounded-xl bg-surface-2 px-3.5 py-3">
              <dt className="text-sm font-semibold">{t(`items.${item}.label`)}</dt>
              <dd className="flex flex-col gap-1">
                {check ? (
                  <StatusBadge
                    tone={OUTCOME_TONE[check.outcome]}
                    label={t(`outcomes.${check.outcome}`)}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
                {check?.note && <span className="text-xs text-muted-foreground">{check.note}</span>}
              </dd>
            </div>
          );
        })}
      </dl>

      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[minmax(9rem,14rem)_1fr]">
        <dt className="text-muted-foreground">{t("form.documentation")}</dt>
        <dd className="flex flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2 font-medium">
            {review.documentation ? t(`documentationOutcomes.${review.documentation}`) : "—"}
            {overridden.documentation && <Badge variant="warning">{t("signed.overridden")}</Badge>}
          </span>
          {review.documentationOverrideReason && (
            <span className="text-muted-foreground">{review.documentationOverrideReason}</span>
          )}
        </dd>
        <dt className="text-muted-foreground">{t("form.eligibility")}</dt>
        <dd className="flex flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2 font-medium">
            {review.eligibility ? t(`eligibilityOutcomes.${review.eligibility}`) : "—"}
            {overridden.eligibility && <Badge variant="warning">{t("signed.overridden")}</Badge>}
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
