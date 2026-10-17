"use client";

import {
  Ban,
  BadgeCheck,
  Clock3,
  Flag,
  Hourglass,
  Pause,
  PenLine,
  Play,
  RotateCw,
  Undo2,
  type LucideIcon,
} from "@/components/icons";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { LICENSE_STATUS_TONES, type LicenseStatus, type RegisterAction } from "@rebp/contracts";
import { ATTENTION_CHIP, ATTENTION_DOT, LIST_GROUP, LIST_ROW } from "@/components/admin/surfaces";
import { LicenceStatusBadge } from "@/components/applications/status-badges";
import { TONE_SOFT_BG, TONE_TEXT } from "@/components/data/tones";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useUrlState } from "@/hooks/use-url-state";
import { formatDateTime, formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LicenceAdminDetail } from "@/server/backoffice/admin-queries";
import { RegisterActionDialog } from "./register-action-dialog";
import { ReissueCertificateDialog } from "./reissue-certificate-dialog";

/** Which statuses each action applies to (mirrors the register-admin transitions, FR-RA-001). */
const ACTIONS: {
  action: RegisterAction;
  from: readonly LicenseStatus[] | "any";
  icon: LucideIcon;
}[] = [
  { action: "SUSPEND", from: ["ACTIVE"], icon: Pause },
  { action: "LIFT", from: ["SUSPENDED"], icon: Play },
  { action: "REVOKE", from: ["ACTIVE", "SUSPENDED", "EXPIRED"], icon: Ban },
  { action: "SURRENDER", from: ["ACTIVE", "SUSPENDED", "EXPIRED"], icon: Undo2 },
  { action: "CORRECT", from: "any", icon: PenLine },
];

interface LicenceAdminSheetProps {
  licence: LicenceAdminDetail;
  canAdminister: boolean;
  today: string;
}

/**
 * Licence detail for register administration (FR-RA-001/002): facts, flags, the append-only
 * status history (licence events) and the register actions allowed from the current status.
 */
export function LicenceAdminSheet({ licence, canAdminister, today }: LicenceAdminSheetProps) {
  const t = useTranslations();
  const locale = useLocale();
  const { set } = useUrlState();
  const [open, setOpen] = useState(true);
  const [action, setAction] = useState<RegisterAction | null>(null);
  const [reissuing, setReissuing] = useState(false);
  // FR-N-012: a certificate can be reissued while the licence is in force.
  const canReissue = ["ACTIVE", "SUSPENDED", "EXPIRED"].includes(licence.status);

  const close = () => {
    setOpen(false);
    window.setTimeout(() => set({ licence: null }, { resetPage: false }), 200);
  };

  const available = ACTIONS.filter(
    (a) => a.from === "any" || a.from.includes(licence.status as LicenseStatus),
  );
  const eventLabel = (code: string) =>
    t.has(`registerAdmin.events.${code}`)
      ? t(`registerAdmin.events.${code}` as "registerAdmin.events.ISSUED")
      : code;
  const flagLabel = (flag: string) =>
    t.has(`registerAdmin.flags.${flag}`)
      ? t(`registerAdmin.flags.${flag}` as "registerAdmin.flags.SUPERVISION_REQUIRED")
      : flag;

  return (
    <Sheet open={open} onOpenChange={(next) => !next && close()}>
      <SheetContent
        side="right"
        className="w-full gap-5 bg-background p-0 sm:max-w-xl"
        data-testid="licence-admin-sheet"
      >
        <div className="flex items-start gap-3 border-b bg-card p-5 pr-14">
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
            <BadgeCheck className="size-6" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <SheetTitle className="truncate font-display text-xl font-semibold">
              {licence.displayName}
            </SheetTitle>
            <SheetDescription className="truncate font-mono text-sm text-muted-foreground">
              {licence.licenceNo}
            </SheetDescription>
            <LicenceStatusBadge status={licence.status as LicenseStatus} className="mt-1" />
          </div>
        </div>

        <div className="flex flex-col gap-6 px-5 pb-10">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">{t("registerAdmin.columns.category")}</dt>
            <dd>{t(`categories.items.${licence.category}.name`)}</dd>
            <dt className="text-muted-foreground">{t("registerAdmin.columns.registration")}</dt>
            <dd className="font-mono">{licence.registrationNo}</dd>
            <dt className="text-muted-foreground">{t("registerAdmin.columns.holder")}</dt>
            <dd>{licence.holderName ?? "—"}</dd>
            <dt className="text-muted-foreground">{t("registerAdmin.columns.firm")}</dt>
            <dd>{licence.firmName ?? "—"}</dd>
            <dt className="text-muted-foreground">{t("registerAdmin.columns.issued")}</dt>
            <dd className="num">{formatDay(licence.issuedAt, locale)}</dd>
            <dt className="text-muted-foreground">{t("registerAdmin.columns.expires")}</dt>
            <dd className="num">{formatDay(licence.expiresAt, locale)}</dd>
            <dt className="text-muted-foreground">{t("registerAdmin.reissue.version")}</dt>
            <dd className="num" data-testid="certificate-version">
              {licence.certificateVersion}
            </dd>
          </dl>

          {licence.flags.length > 0 && (
            <section className="flex flex-col gap-2" aria-labelledby="flags-title">
              <h3 id="flags-title" className="text-base">
                {t("registerAdmin.detail.flags")}
              </h3>
              <ul className="flex flex-wrap gap-1.5">
                {licence.flags.map((flag) => (
                  <li key={flag}>
                    <span className={ATTENTION_CHIP}>
                      <span aria-hidden className={ATTENTION_DOT} />
                      <Flag className="size-3.5" aria-hidden /> {flagLabel(flag)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {licence.pending && (
            <Alert variant="warning" title={t("registerAdmin.detail.pendingTitle")}>
              {t("registerAdmin.detail.pendingBody", {
                action: t(
                  `registerAdmin.actions.${licence.pending.action as RegisterAction}.title`,
                ),
              })}
            </Alert>
          )}

          {canAdminister && (
            <section className="flex flex-col gap-3" aria-labelledby="actions-title">
              <h3 id="actions-title" className="text-base">
                {t("registerAdmin.detail.actions")}
              </h3>
              <div className="grid grid-cols-1 gap-2 xs:grid-cols-2">
                {available.map(({ action: a, icon: Icon }) => (
                  <Button
                    key={a}
                    variant={a === "REVOKE" ? "destructive" : a === "CORRECT" ? "ghost" : "outline"}
                    className="justify-start"
                    disabled={Boolean(licence.pending)}
                    onClick={() => setAction(a)}
                    data-testid={`register-action-${a}`}
                  >
                    <Icon aria-hidden /> {t(`registerAdmin.actions.${a}.button`)}
                  </Button>
                ))}
                {canReissue && (
                  <Button
                    variant="ghost"
                    className="justify-start"
                    onClick={() => setReissuing(true)}
                    data-testid="reissue-certificate"
                  >
                    <RotateCw aria-hidden /> {t("registerAdmin.reissue.button")}
                  </Button>
                )}
              </div>
            </section>
          )}

          <Separator />

          <section className="flex flex-col gap-3" aria-labelledby="history-title">
            <div>
              <h3 id="history-title" className="text-base">
                {t("registerAdmin.detail.history")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("registerAdmin.detail.historyHint")}
              </p>
            </div>
            {licence.events.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("registerAdmin.detail.noHistory")}</p>
            ) : (
              <ol className={LIST_GROUP}>
                {licence.events.map((event) => {
                  const tone = LICENSE_STATUS_TONES[event.toStatus as LicenseStatus] ?? "neutral";
                  return (
                    <li key={event.id} className={cn("flex gap-3", LIST_ROW, "py-3")}>
                      <span
                        className={cn(
                          "inline-flex size-9 shrink-0 items-center justify-center rounded-full",
                          TONE_SOFT_BG[tone],
                          TONE_TEXT[tone],
                        )}
                      >
                        <Clock3 className="size-4" aria-hidden />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-sm font-semibold">{eventLabel(event.action)}</span>
                          {event.fromStatus !== event.toStatus && (
                            <LicenceStatusBadge status={event.toStatus as LicenseStatus} />
                          )}
                        </div>
                        {event.reason && (
                          <p className="text-sm break-words text-foreground/80">{event.reason}</p>
                        )}
                        <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <time dateTime={new Date(event.at).toISOString()} className="num">
                            {formatDateTime(event.at, locale)}
                          </time>
                          {event.actorName && <span>{event.actorName}</span>}
                          {event.reference && (
                            <span className="font-mono">
                              {t("registerAdmin.detail.reference", { reference: event.reference })}
                            </span>
                          )}
                          {(event.startsOn || event.endsOn) && (
                            <span className="inline-flex items-center gap-1">
                              <Hourglass className="size-3" aria-hidden />
                              {event.endsOn
                                ? t("registerAdmin.detail.period", {
                                    from: event.startsOn ? formatDay(event.startsOn, locale) : "—",
                                    to: formatDay(event.endsOn, locale),
                                  })
                                : t("registerAdmin.detail.from", {
                                    from: formatDay(event.startsOn!, locale),
                                  })}
                            </span>
                          )}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      </SheetContent>
      {reissuing && (
        <ReissueCertificateDialog
          licenceId={licence.id}
          licenceNo={licence.licenceNo}
          version={licence.certificateVersion}
          onClose={() => setReissuing(false)}
        />
      )}
      {action && (
        <RegisterActionDialog
          key={action}
          licenceId={licence.id}
          licenceNo={licence.licenceNo}
          displayName={licence.displayName}
          action={action}
          today={today}
          onClose={() => setAction(null)}
        />
      )}
    </Sheet>
  );
}
