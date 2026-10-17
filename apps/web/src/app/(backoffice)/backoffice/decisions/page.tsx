import { ArrowRight, Gavel, Hourglass, UserRound } from "@/components/icons";
import { applicantPhotoUrls } from "@/server/profile/documents";
import { CategoryTile } from "@/components/applications/category-tile";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PageWidth } from "@/components/layout/page-width";
import { LIST_GROUP } from "@/components/review/marks";
import { RECOMMENDATION_TONES } from "@/components/review/signed-review";
import { SlaBadge } from "@/components/review/sla-badge";
import { EmptyState } from "@/components/ui/empty-state";
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
 * Decisions queue (WP-3.6, FR-M-001): applications awaiting a Section M decision as one list
 * group — the category tile, reference and applicant, the signed review's recommendation, the
 * reviewing officer, how long the file has waited, its SLA and the one action, Decide.
 */
export default async function DecisionsPage() {
  const { user } = await requireCapability("decision.make");
  const [t, locale, items] = await Promise.all([
    getTranslations(),
    getLocale(),
    pendingDecisions(),
  ]);
  const now = new Date().getTime();
  const slas = new Map(items.map((item) => [item.id, slaState(item)]));
  const overdue = items.filter((item) => slas.get(item.id) === "breached").length;
  const approve = items.filter((item) => item.review?.recommendation === "APPROVE").length;

  const photos = await applicantPhotoUrls(items.map((i) => i.applicantId));
  return (
    <>
      <PageWidth wide />
      <PageHeader
        eyebrow={t("decide.count", { count: items.length })}
        title={t("decide.listTitle")}
        description={t("decide.listSubtitle")}
        mood={items.length === 0 ? "celebrate" : "badge"}
        bubble={
          items.length === 0
            ? t("decide.bubble.empty")
            : t("decide.bubble.waiting", { count: items.length })
        }
        tone={overdue > 0 ? "danger" : undefined}
        stats={
          items.length === 0
            ? undefined
            : [
                { value: items.length, label: t("decide.stats.waiting") },
                { value: approve, label: t("decide.stats.approve"), tone: "muted" },
                ...(overdue > 0
                  ? [{ value: overdue, label: t("decide.stats.overdue"), tone: "now" as const }]
                  : []),
              ]
        }
      />
      {items.length === 0 ? (
        <EmptyState icon={Gavel} title={t("decide.empty")} description={t("decide.emptyHint")} />
      ) : (
        <ul className={LIST_GROUP} data-testid="decision-list">
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
                  className="group flex flex-col gap-3 px-4 py-3.5 transition-colors duration-(--dur-2) outline-none hover:bg-primary/[0.035] focus-visible:bg-primary/[0.05] focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:ring-inset @2xl/main:grid @2xl/main:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] @2xl/main:items-center @2xl/main:gap-4 dark:hover:bg-surface-3"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <CategoryTile category={item.category} photo={photos.get(item.applicantId)} />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-mono text-sm font-semibold group-hover:text-link">
                        {item.referenceNo}
                      </span>
                      <span className="truncate text-sm text-muted-foreground">
                        {item.applicant.fullName} · {t(`categories.items.${item.category}.name`)}
                      </span>
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5 pl-13 @2xl/main:pl-0">
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
                  <span className="flex flex-col gap-1 pl-13 text-sm @2xl/main:pl-0">
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <UserRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="sr-only">{t("decide.officer")}: </span>
                      <span className="truncate">
                        {item.review?.officer.fullName ?? item.assignedOfficer?.fullName ?? "—"}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Hourglass className="size-3.5 shrink-0" aria-hidden />
                      {t("decide.waiting", { count: days })}
                      {item.review?.signedAt && ` · ${formatDay(item.review.signedAt, locale)}`}
                    </span>
                  </span>
                  <span className="flex items-center justify-between gap-3 pl-13 @2xl/main:justify-end @2xl/main:pl-0">
                    <SlaBadge state={slas.get(item.id) ?? null} />
                    <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors group-hover:bg-[color-mix(in_oklch,var(--primary)_86%,black)]">
                      <Gavel className="size-4" aria-hidden />
                      {t("decide.open")}
                      <ArrowRight
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
