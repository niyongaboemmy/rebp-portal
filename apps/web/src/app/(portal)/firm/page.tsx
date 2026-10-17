import { Building2, Download, Inbox, MapPin, TriangleAlert, UsersRound } from "@/components/icons";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { LicenceStatusBadge } from "@/components/applications/status-badges";
import { EndAffiliationButton } from "@/components/applications/end-affiliation";
import { StatTile } from "@/components/data/stat-tile";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { daysUntil, formatDay } from "@/lib/format";
import { requireCapability } from "@/server/auth/guards";
import { db } from "@/server/db";
import { firmRoster, firmsForUser } from "@/server/firms/firms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("firm"))("title") };
}

/**
 * Firm workspace (FR-FIRM-001…005): the firm, its branches, the roster of affiliated practitioners
 * with status, expiry, supervisor and branch (CSV export), the confirmation inbox, and ending an
 * affiliation (BR-050 grace starts for the practitioner).
 */
export default async function FirmPage({ searchParams }: PageProps<"/firm">) {
  const { user } = await requireCapability("firmRoles.manage");
  const [t, tc, locale, firms, query] = await Promise.all([
    getTranslations("firm"),
    getTranslations("categories.items"),
    getLocale(),
    firmsForUser(user.id),
    searchParams,
  ]);
  if (firms.length === 0) {
    return (
      <>
        <PageHeader title={t("title")} />
        <EmptyState icon={Building2} title={t("emptyTitle")} description={t("emptyBody")} />
      </>
    );
  }
  const firm = firms.find((f) => f.id === query.firm) ?? firms[0]!;
  const [roster, principal, pendingConfirmations] = await Promise.all([
    firmRoster(firm.id, user),
    firm.principalLicenceId
      ? db.licence.findUnique({
          where: { id: firm.principalLicenceId },
          select: { displayName: true, licenceNo: true, holderId: true },
        })
      : null,
    db.confirmationRequest.count({ where: { addresseeId: user.id, status: "PENDING" } }),
  ]);
  const active = roster.filter((r) => r.status === "ACTIVE");
  const expiring = active.filter((r) => daysUntil(r.expiresAt) <= 90).length;
  const flagged = roster.filter((r) => r.flags.length > 0).length;
  const canEnd = principal?.holderId === user.id || firm.ownerId === user.id;

  return (
    <>
      <PageHeader
        eyebrow={firm.registrant?.registrationNo ?? firm.companyRegNo}
        title={firm.tradingName ?? firm.legalName}
        description={
          principal
            ? t("principal", { name: principal.displayName, licence: principal.licenceNo })
            : t("noPrincipal")
        }
        actions={
          <Button asChild variant="outline">
            <a href={`/api/exports/roster?firm=${firm.id}`}>
              <Download aria-hidden /> {t("export")}
            </a>
          </Button>
        }
      />
      {firms.length > 1 && (
        <nav aria-label={t("switch")} className="flex flex-wrap gap-2">
          {firms.map((f) => (
            <Link
              key={f.id}
              href={`/firm?firm=${f.id}` as Route}
              aria-current={f.id === firm.id ? "page" : undefined}
              className="rounded-full bg-card px-3.5 py-1.5 text-sm font-medium aria-[current=page]:bg-foreground aria-[current=page]:text-background"
            >
              {f.tradingName ?? f.legalName}
            </Link>
          ))}
        </nav>
      )}

      <section
        aria-label={t("kpis")}
        className="grid grid-cols-2 gap-3 sm:gap-4 @5xl/main:grid-cols-4"
      >
        <StatTile
          icon={UsersRound}
          label={t("activeLicences")}
          value={active.length}
          hint={t("rosterTotal", { count: roster.length })}
        />
        <StatTile
          icon={TriangleAlert}
          label={t("expiring")}
          value={expiring}
          hint={t("expiringHint")}
        />
        <StatTile
          icon={TriangleAlert}
          label={t("flagged")}
          value={flagged}
          hint={t("flaggedHint")}
        />
        <StatTile
          icon={Inbox}
          label={t("confirmations")}
          value={pendingConfirmations}
          hint={t("confirmationsHint")}
          href="/confirmations"
        />
      </section>

      <section aria-labelledby="roster-title" className="flex flex-col gap-3">
        <h2 id="roster-title" className="text-lg">
          {t("roster")}
        </h2>
        {roster.length === 0 ? (
          <p className="rounded-2xl bg-card/70 p-5 text-sm text-muted-foreground">
            {t("rosterEmpty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {roster.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-3 rounded-2xl border bg-card p-4 raised @2xl/main:flex-row @2xl/main:items-center"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-semibold">{r.displayName}</span>
                  <span className="text-xs text-muted-foreground">
                    {tc(`${r.category}.name`)} · <span className="font-mono">{r.licenceNo}</span> ·{" "}
                    {r.registrant.registrationNo}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs @2xl/main:flex @2xl/main:gap-6">
                  <div>
                    <dt className="text-muted-foreground">{t("expires")}</dt>
                    <dd className="font-medium">{formatDay(r.expiresAt, locale)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t("supervisor")}</dt>
                    <dd className="font-medium">{r.supervisor?.displayName ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t("branch")}</dt>
                    <dd className="font-medium">{r.branch?.name ?? "—"}</dd>
                  </div>
                </dl>
                <div className="flex items-center gap-2">
                  <LicenceStatusBadge status={r.status} />
                  {r.flags.length > 0 && (
                    <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">
                      {t(`flags.${r.flags[0]}`)}
                    </span>
                  )}
                  {canEnd &&
                    r.category !== "PRINCIPAL_BROKER" &&
                    r.holderId !== user.id &&
                    r.status === "ACTIVE" && (
                      <EndAffiliationButton licenceId={r.id} name={r.displayName} />
                    )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {firm.branches.length > 0 && (
        <section aria-labelledby="branches-title" className="flex flex-col gap-3">
          <h2 id="branches-title" className="text-lg">
            {t("branches")}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 @5xl/main:grid-cols-3">
            {firm.branches.map((b) => (
              <li
                key={b.id}
                className="flex items-center gap-3 rounded-2xl border bg-card p-4 raised"
              >
                <MapPin className="size-5 text-link" aria-hidden />
                <div className="flex flex-col">
                  <span className="font-semibold">{b.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {b.managingLicenceId ? t("managed") : t("noManager")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
