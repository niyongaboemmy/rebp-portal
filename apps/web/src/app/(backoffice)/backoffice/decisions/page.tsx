import { ChevronRight, Gavel, Hourglass, UserRound } from "@/components/icons";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { RECOMMENDATION_TONES } from "@/components/review/signed-review";
import { SlaBadge } from "@/components/review/sla-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageWidth } from "@/components/layout/page-width";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDay } from "@/lib/format";
import { requireCapability } from "@/server/auth/guards";
import { slaState } from "@/server/backoffice/review";
import { pendingDecisions } from "@/server/backoffice/review-queries";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("decide"))("listTitle") };
}

/**
 * Decisions queue (WP-3.6, FR-M-001): applications awaiting a Section M decision with the signed
 * review's recommendation, the reviewing officer and how long the file has been waiting.
 */
export default async function DecisionsPage() {
  const { user } = await requireCapability("decision.make");
  const [t, locale, items] = await Promise.all([
    getTranslations(),
    getLocale(),
    pendingDecisions(),
  ]);
  const now = new Date().getTime();

  return (
    <>
      <PageWidth wide />
      <PageHeader
        title={t("decide.listTitle")}
        description={t("decide.listSubtitle")}
        eyebrow={t("decide.count", { count: items.length })}
      />
      {items.length === 0 ? (
        <EmptyState icon={Gavel} title={t("decide.empty")} description={t("decide.emptyHint")} />
      ) : (
        <ul className="flex flex-col gap-2.5" data-testid="decision-list">
          {items.map((item, index) => {
            const since = item.review?.signedAt ?? item.updatedAt;
            const days = Math.max(0, Math.floor((now - since.getTime()) / 86_400_000));
            const reviewedByMe = item.assignedOfficerId === user.id;
            return (
              <li
                key={item.id}
                className="animate-rise"
                style={{ animationDelay: `${Math.min(index, 10) * 25}ms` }}
              >
                <Link
                  href={`/backoffice/decisions/${item.id}` as Route}
                  className="group flex flex-col gap-3 rounded-2xl border bg-card p-4 raised transition-[background-color,transform] duration-(--dur-2) outline-none hover:bg-primary/[0.05] focus-visible:ring-[3px] focus-visible:ring-ring/40 active:scale-[0.995] @2xl/main:grid @2xl/main:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] @2xl/main:items-center @2xl/main:gap-4"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-mono text-sm font-semibold group-hover:text-link">
                      {item.referenceNo}
                    </span>
                    <span className="truncate text-sm text-muted-foreground">
                      {item.applicant.fullName} · {t(`categories.items.${item.category}.name`)}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {item.review?.recommendation ? (
                      <StatusBadge
                        tone={RECOMMENDATION_TONES[item.review.recommendation] ?? "neutral"}
                        label={t("decide.recommends", {
                          recommendation: t(
                            `review.recommendations.${item.review.recommendation}.label`,
                          ),
                        })}
                      />
                    ) : (
                      <StatusBadge tone="neutral" label={t("decide.noReview")} />
                    )}
                    {reviewedByMe && <StatusBadge tone="warning" label={t("decide.youReviewed")} />}
                  </span>
                  <span className="flex flex-col gap-1 text-sm">
                    <span className="inline-flex items-center gap-1.5">
                      <UserRound className="size-4 text-muted-foreground" aria-hidden />
                      <span className="sr-only">{t("decide.officer")}: </span>
                      <span className="truncate">
                        {item.review?.officer.fullName ?? item.assignedOfficer?.fullName ?? "—"}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Hourglass className="size-3.5" aria-hidden />
                      {t("decide.waiting", { count: days })}
                      {item.review?.signedAt && ` · ${formatDay(item.review.signedAt, locale)}`}
                    </span>
                  </span>
                  <span className="flex items-center justify-between gap-2 @2xl/main:justify-end">
                    <SlaBadge state={slaState(item)} />
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground group-hover:text-link">
                      {t("decide.open")}
                      <ChevronRight
                        className="size-4 transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
