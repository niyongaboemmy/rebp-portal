import { ArrowRight, FilePlus2, FileStack } from "@/components/icons";
import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CATEGORY_INFO, checkSection, sectionsFor } from "@rebp/contracts";
import { ApplicationsBoard, type BoardItem } from "@/components/applications/applications-board";
import { LookAtPointer } from "@/components/motion/look-at-pointer";
import { ProfileBuddy } from "@/components/profile/profile-buddy";
import { lifecycleOf } from "@/lib/lifecycle";
import { cn } from "@/lib/utils";
import { unreadLinks } from "@/server/notifications/inbox";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { asData, listApplications, sectionContext } from "@/server/applications/applications";
import { requireCapability } from "@/server/auth/guards";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("applications"))("title") };
}

type Item = Awaited<ReturnType<typeof listApplications>>[number];

/** The one next action for an application (FR-PORTAL-001 "next action"). */
function nextAction(app: Item): { key: "continue" | "respond" | "pay" | "view"; href: Route } {
  switch (app.status) {
    case "DRAFT":
      return { key: "continue", href: `/applications/${app.id}/wizard` as Route };
    case "ACTION_REQUIRED":
      return { key: "respond", href: `/applications/${app.id}/wizard` as Route };
    case "PENDING_PAYMENT":
      return { key: "pay", href: `/applications/${app.id}/pay` as Route };
    default:
      return { key: "view", href: `/applications/${app.id}` as Route };
  }
}

/** What happens next per status, for the card (the status page's own sentences). */
const NEXT: Partial<Record<string, string>> = {
  PENDING_CONFIRMATIONS: "confirmations",
  SUBMITTED: "submitted",
  UNDER_REVIEW: "review",
  ACTION_REQUIRED: "action",
  FURTHER_ASSESSMENT: "assessment",
  PENDING_DECISION: "decision",
  LICENSE_ISSUED: "issued",
  REJECTED: "rejected",
  WITHDRAWN: "withdrawn",
  EXPIRED_DRAFT: "expired",
  PENDING_PAYMENT: "payment",
};

/**
 * FR-PORTAL-001 / UX-028: the applicant's applications — a hero that says whose turn it is (with
 * a companion acting it out), then a board filtered by turn, each card with its journey, draft
 * progress, what happens next, unread updates and the one action.
 */
export default async function ApplicationsPage() {
  const { user } = await requireCapability("application.edit");
  const [t, td, tc, tt, locale, apps, unread] = await Promise.all([
    getTranslations("applications"),
    getTranslations("applications.detail"),
    getTranslations("categories.items"),
    getTranslations("applicationTypes"),
    getLocale(),
    listApplications(user.id),
    unreadLinks(user.id),
  ]);

  // Draft progress: share of applicable sections that are complete (same check as the wizard).
  const progress = new Map<string, number>();
  for (const app of apps.filter((a) => a.status === "DRAFT")) {
    const ctx = await sectionContext(app);
    const keys = sectionsFor(app.type, app.category);
    const done = keys.filter(
      (k) => Object.keys(checkSection(k, asData(app.data), ctx)).length === 0,
    ).length;
    progress.set(app.id, Math.round((done / keys.length) * 100));
  }

  const items: BoardItem[] = apps.map((app) => ({
    id: app.id,
    reference: app.referenceNo,
    category: tc(`${app.category}.name`),
    code: CATEGORY_INFO[app.category].monogram,
    type: tt(`${app.type}.name`),
    status: app.status,
    lastStep: app.lastStep,
    progress: progress.get(app.id),
    action: nextAction(app),
    next: NEXT[app.status] ? td(`next.${NEXT[app.status]}` as "next.review") : undefined,
    updatedAt: app.updatedAt.toISOString(),
    respondBy: app.infoRequests[0]?.dueAt.toISOString(),
    unread: unread.filter((href) => href.includes(app.id)).length,
  }));

  // Whose turn it is, overall: the hero and its companion say it.
  const turns = items.map((i) => lifecycleOf(i.status, i.lastStep));
  const yours = turns.filter(
    (l) => l.state === "attention" || (l.state === "active" && l.index <= 2),
  ).length;
  const theirs = turns.filter((l) => l.state === "active" && l.index > 2).length;
  const finished = turns.filter((l) => l.state === "done").length;
  const mood = yours > 0 ? "write" : theirs > 0 ? "waiting" : finished > 0 ? "celebrate" : "wave";

  return (
    <>
      <section
        aria-labelledby="apps-title"
        className="hero-surface relative flex items-center gap-4 overflow-hidden rounded-[1.75rem] py-5 pr-2 pl-5 sm:pl-7"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <h1 id="apps-title" className="text-2xl font-bold tracking-tight @3xl/main:text-3xl">
            {t("title")}
          </h1>
          {/* At a glance: whose turn, in three numbers — plain stats (a dot, a number, a word),
              so the only thing that looks pressable is New application. */}
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
            {[
              { key: "yours", count: yours, dot: cn("bg-primary", yours > 0 && "lifecycle-pulse") },
              { key: "theirs", count: theirs, dot: "bg-primary/45" },
              { key: "finished", count: finished, dot: "bg-foreground/20 dark:bg-white/25" },
            ].map(({ key, count, dot }) => (
              <li key={key} className="inline-flex items-center gap-2">
                <span aria-hidden className={cn("size-2 shrink-0 rounded-full", dot)} />
                <span className="font-bold num text-foreground">{count}</span>
                {t(`summary.${key}`)}
              </li>
            ))}
          </ul>
          <Button asChild className="group w-fit rounded-full">
            <Link href="/applications/new">
              <FilePlus2 aria-hidden /> {t("newButton")}
            </Link>
          </Button>
        </div>
        <div className="relative -mb-5 hidden shrink-0 self-end @md/main:block">
          <span
            aria-hidden
            className="absolute top-4 right-[72%] z-10 hidden rounded-2xl rounded-br-sm bg-primary-soft px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-primary-soft-foreground @2xl/main:block"
          >
            {t(`board.bubble.${mood}`)}
          </span>
          <LookAtPointer>
            <ProfileBuddy mood={mood} className="h-32 w-auto @3xl/main:h-40" />
          </LookAtPointer>
        </div>
      </section>

      {apps.length === 0 ? (
        <EmptyState
          icon={FileStack}
          title={t("emptyTitle")}
          description={t("emptyBody")}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild className="rounded-full">
                <Link href="/applications/new">
                  {t("newButton")} <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link href="/eligibility">{t("checkEligibility")}</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <ApplicationsBoard items={items} locale={locale} />
      )}
    </>
  );
}
