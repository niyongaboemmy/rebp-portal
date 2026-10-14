"use client";

import {
  AlertTriangle,
  Check,
  Lock,
  Minus,
  Plus,
  Power,
  RotateCcw,
  UserX,
} from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  assignmentWarnings,
  CAPABILITIES,
  capabilitiesFor,
  isStaffRole,
  ROLES,
  type Capability,
  type PermissionMatrix,
  type Role,
} from "@rebp/contracts";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useStepUp } from "@/components/security/step-up";
import { capabilityKey, ROLE_META } from "@/config/roles";
import { useErrorMessage } from "@/hooks/use-error-message";
import { cn, formatDate } from "@/lib/utils";
import { setUserStatusAction, updateUserRolesAction } from "@/server/actions/access";
import type { UserRow } from "@/server/access/users";
import { roleStyle } from "./role-chip";

interface ManageAccessSheetProps {
  user: UserRow;
  matrix: PermissionMatrix;
  editable: boolean;
  isSelf: boolean;
  onClose: () => void;
}

/** Side drawer to review and change one person's roles and account status (SEC-004, SEC-011). */
export default function ManageAccessSheet({
  user,
  matrix,
  editable,
  isSelf,
  onClose,
}: ManageAccessSheetProps) {
  const t = useTranslations();
  const router = useRouter();
  const stepUp = useStepUp();
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState(true);
  const [roles, setRoles] = useState<Role[]>(user.roles);
  const [reason, setReason] = useState("");
  const [saving, startSave] = useTransition();

  const before = useMemo(() => new Set(capabilitiesFor(user.roles, matrix)), [user.roles, matrix]);
  const after = useMemo(() => new Set(capabilitiesFor(roles, matrix)), [roles, matrix]);
  const gained = CAPABILITIES.filter((c) => after.has(c) && !before.has(c));
  const lost = CAPABILITIES.filter((c) => before.has(c) && !after.has(c));
  const dirty = roles.length !== user.roles.length || roles.some((r) => !user.roles.includes(r));
  const warnings = assignmentWarnings(roles, {
    matrix,
    hasMfa: user.mfaMethods.length > 0,
    accountType: user.accountType,
  });

  const close = () => {
    setOpen(false);
    window.setTimeout(onClose, 200);
  };

  const toggle = (role: Role) =>
    setRoles((current) =>
      current.includes(role)
        ? current.filter((r) => r !== role)
        : ROLES.filter((r) => r === role || current.includes(r)),
    );

  const save = () =>
    startSave(async () => {
      const result = await stepUp(() => updateUserRolesAction({ userId: user.id, roles }));
      if (!result.ok) return void toast.error(errorMessage(result.error, result.meta));
      toast.success(t("access.manage.saved", { name: user.fullName }));
      router.refresh();
      close();
    });

  const setStatus = (disabled: boolean) =>
    startSave(async () => {
      const result = await stepUp(() =>
        setUserStatusAction({ userId: user.id, disabled, reason: reason || undefined }),
      );
      if (!result.ok) return void toast.error(errorMessage(result.error, result.meta));
      toast.success(
        t(disabled ? "access.manage.disabledToast" : "access.manage.enabledToast", {
          name: user.fullName,
        }),
      );
      router.refresh();
      close();
    });

  const capLabel = (cap: Capability) =>
    t(`capabilities.${capabilityKey(cap)}.label` as "capabilities.audit_view.label");

  return (
    <Sheet open={open} onOpenChange={(next) => !next && close()}>
      <SheetContent
        side="right"
        className="w-full gap-5 bg-background p-0 sm:max-w-xl"
        data-testid="manage-access"
      >
        <div className="flex items-center gap-3 border-b bg-card p-5 pr-14">
          <Avatar name={user.fullName} className="size-12 text-base" />
          <div className="min-w-0">
            <SheetTitle className="truncate font-display text-xl font-semibold">
              {user.fullName}
            </SheetTitle>
            <SheetDescription className="truncate text-sm text-muted-foreground">
              {user.email}
            </SheetDescription>
          </div>
        </div>

        <div className="flex flex-col gap-6 px-5 pb-28">
          {isSelf && <Alert variant="info">{t("access.manage.selfNote")}</Alert>}

          <section className="flex flex-col gap-3" aria-labelledby="roles-title">
            <div>
              <h3 id="roles-title" className="text-base">
                {t("access.manage.rolesTitle")}
              </h3>
              {editable && (
                <p className="text-xs text-muted-foreground">{t("access.manage.rolesHint")}</p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 xs:grid-cols-2">
              {ROLES.map((role) => {
                const Icon = ROLE_META[role].icon;
                const on = roles.includes(role);
                const blocked = user.accountType === "ORGANISATION" && isStaffRole(role);
                return (
                  <button
                    key={role}
                    type="button"
                    disabled={!editable || blocked}
                    aria-pressed={on}
                    data-testid={`role-toggle-${role}`}
                    onClick={() => toggle(role)}
                    style={roleStyle(role)}
                    className={cn(
                      "group relative flex items-start gap-3 rounded-2xl border-2 p-3 text-left transition-all duration-200 outline-none",
                      "focus-visible:ring-[3px] focus-visible:ring-ring/40 enabled:active:scale-[0.98] disabled:cursor-not-allowed",
                      on ? "role-ring" : "border-transparent bg-card/60 hover:border-border",
                      !editable && !on && "opacity-50",
                      blocked && "opacity-40",
                    )}
                  >
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl role-tint [&_svg]:size-[1.1rem]">
                      <Icon aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5 pr-5">
                      <span className="text-sm font-semibold">{t(`roles.${role}`)}</span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {t(`roleInfo.${role}`)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "absolute top-2.5 right-2.5 inline-flex size-5 items-center justify-center rounded-full transition-all duration-200",
                        on
                          ? "scale-100 bg-primary text-primary-foreground"
                          : "scale-90 border border-input",
                      )}
                      aria-hidden
                    >
                      {on && <Check className="size-3" strokeWidth={3} />}
                      {blocked && <Lock className="size-3 text-muted-foreground" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {warnings.length > 0 && (
            <div className="flex flex-col gap-2" data-testid="role-warnings">
              {warnings.map((w) => (
                <Alert key={w} variant={w === "staffOnOrganisation" ? "danger" : "warning"}>
                  {t(`access.manage.warnings.${w}`)}
                </Alert>
              ))}
            </div>
          )}

          <section className="flex flex-col gap-3" aria-labelledby="preview-title">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="preview-title" className="text-base">
                {t("access.manage.preview")}
              </h3>
              <div className="flex gap-1.5" aria-live="polite">
                {gained.length > 0 && (
                  <Badge variant="success">
                    <Plus /> {t("access.manage.gained", { count: gained.length })}
                  </Badge>
                )}
                {lost.length > 0 && (
                  <Badge variant="danger">
                    <Minus /> {t("access.manage.lost", { count: lost.length })}
                  </Badge>
                )}
              </div>
            </div>
            <ul className="flex flex-wrap gap-1.5" data-testid="capability-preview">
              {CAPABILITIES.filter((c) => after.has(c) || before.has(c)).map((cap) => {
                const isGained = gained.includes(cap);
                const isLost = lost.includes(cap);
                return (
                  <li
                    key={cap}
                    data-state={isGained ? "gained" : isLost ? "lost" : "kept"}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all",
                      isGained && "animate-in bg-success-soft text-success zoom-in-90",
                      isLost && "bg-danger-soft text-destructive line-through",
                      !isGained && !isLost && "bg-card",
                    )}
                  >
                    {isGained && <Plus className="size-3" aria-hidden />}
                    {isLost && <Minus className="size-3" aria-hidden />}
                    {capLabel(cap)}
                  </li>
                );
              })}
            </ul>
          </section>

          <Separator />

          <section className="flex flex-col gap-3" aria-labelledby="status-title">
            <h3 id="status-title" className="text-base">
              {t("access.manage.statusTitle")}
            </h3>
            {user.disabled ? (
              <Alert variant="danger" title={t("access.people.disabled")}>
                {user.disabledReason}
              </Alert>
            ) : (
              <p className="text-sm text-muted-foreground">{t("access.manage.statusActive")}</p>
            )}
            {editable &&
              (user.disabled ? (
                <Button
                  variant="outline"
                  className="self-start"
                  disabled={saving}
                  onClick={() => setStatus(false)}
                >
                  <Power /> {t("access.manage.enable")}
                </Button>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label htmlFor="disable-reason" className="sr-only">
                    {t("access.manage.disableReason")}
                  </label>
                  <input
                    id="disable-reason"
                    value={reason}
                    maxLength={300}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={t("access.manage.disableReason")}
                    className="h-11 flex-1 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 sm:h-10"
                  />
                  <Button variant="destructive" disabled={saving} onClick={() => setStatus(true)}>
                    <UserX /> {t("access.manage.disable")}
                  </Button>
                </div>
              ))}
            {user.lastSignInAt && (
              <p className="text-xs text-muted-foreground">
                {t("access.people.lastSignIn", { date: formatDate(user.lastSignInAt) })}
              </p>
            )}
          </section>
        </div>

        {editable && (
          <div
            className={cn(
              "sticky bottom-0 mt-auto flex items-center gap-2 border-t bg-card/95 p-4 backdrop-blur transition-all duration-300 supports-[backdrop-filter]:bg-card/80",
              dirty ? "visible translate-y-0 opacity-100" : "invisible translate-y-2 opacity-0",
            )}
          >
            {warnings.includes("sodCombined") && (
              <AlertTriangle className="text-warning-strong size-5 shrink-0" aria-hidden />
            )}
            <Button
              variant="ghost"
              onClick={() => setRoles(user.roles)}
              disabled={!dirty || saving}
            >
              <RotateCcw /> {t("access.manage.undo")}
            </Button>
            <Button
              className="ml-auto"
              onClick={save}
              loading={saving}
              disabled={!dirty || roles.length === 0 || warnings.includes("staffOnOrganisation")}
            >
              {t("access.manage.save")}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
