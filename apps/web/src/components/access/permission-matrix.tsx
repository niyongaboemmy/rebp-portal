"use client";

import { Check, Lock, RotateCcw, Search, Sparkles } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  applyOverrides,
  CAPABILITIES,
  CAPABILITY_GROUPS,
  CAPABILITY_META,
  cellLock,
  DEFAULT_PERMISSIONS,
  isStaffRole,
  ROLES,
  validateMatrix,
  type Capability,
  type MatrixViolation,
  type PermissionMatrix,
  type PermissionOverride,
  type Role,
} from "@rebp/contracts";
import { useStepUp } from "@/components/security/step-up";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { capabilityKey, ROLE_META } from "@/config/roles";
import { useErrorMessage } from "@/hooks/use-error-message";
import { cn } from "@/lib/utils";
import { resetMatrixAction, saveMatrixAction } from "@/server/actions/access";
import { RoleChip, roleStyle } from "./role-chip";

interface PermissionMatrixProps {
  matrix: PermissionMatrix;
  roleCounts: Record<Role, number>;
  canEdit: boolean;
}

const cellId = (role: Role, cap: Capability) => `${role}|${cap}`;

function violationCells(violations: MatrixViolation[]): Set<string> {
  const cells = new Set<string>();
  for (const v of violations) {
    if ("capabilities" in v) v.capabilities.forEach((c) => cells.add(cellId(v.role, c)));
    else cells.add(cellId(v.role, v.capability));
  }
  return cells;
}

/** Interactive role × capability matrix with draft changes, live guard-rails and a review step. */
export function PermissionMatrixEditor({ matrix, roleCounts, canEdit }: PermissionMatrixProps) {
  const t = useTranslations();
  const router = useRouter();
  const stepUp = useStepUp();
  const errorMessage = useErrorMessage();
  const [draft, setDraft] = useState<Map<string, PermissionOverride>>(new Map());
  const [filter, setFilter] = useState("");
  const [hover, setHover] = useState<{ role?: Role; cap?: Capability }>({});
  const [mobileRole, setMobileRole] = useState<Role>("APPLICANT");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [saving, startSave] = useTransition();

  const changes = useMemo(() => [...draft.values()], [draft]);
  const next = useMemo(() => applyOverrides(changes, matrix), [changes, matrix]);
  const violations = useMemo(() => validateMatrix(next), [next]);
  const badCells = useMemo(() => violationCells(violations), [violations]);
  const hasOverrides = ROLES.some((r) =>
    CAPABILITIES.some((c) => matrix[r].includes(c) !== DEFAULT_PERMISSIONS[r].includes(c)),
  );

  const capLabel = (cap: Capability) =>
    t(`capabilities.${capabilityKey(cap)}.label` as "capabilities.audit_view.label");
  const capDescription = (cap: Capability) =>
    t(`capabilities.${capabilityKey(cap)}.description` as "capabilities.audit_view.description");

  const query = filter.trim().toLowerCase();
  const visible = CAPABILITIES.filter(
    (cap) =>
      !query || capLabel(cap).toLowerCase().includes(query) || cap.toLowerCase().includes(query),
  );

  const toggle = (role: Role, cap: Capability) => {
    if (!canEdit || cellLock(role, cap)) return;
    setDraft((current) => {
      const copy = new Map(current);
      const id = cellId(role, cap);
      if (copy.has(id)) copy.delete(id);
      else copy.set(id, { role, capability: cap, granted: !matrix[role].includes(cap) });
      return copy;
    });
  };

  const save = () =>
    startSave(async () => {
      const result = await stepUp(() => saveMatrixAction({ changes }));
      if (!result.ok) return void toast.error(errorMessage(result.error, result.meta));
      toast.success(t("access.matrix.saved", { count: result.data.changed }));
      setDraft(new Map());
      setReviewOpen(false);
      router.refresh();
    });

  const reset = () =>
    startSave(async () => {
      const result = await stepUp(() => resetMatrixAction());
      if (!result.ok) return void toast.error(errorMessage(result.error, result.meta));
      toast.success(t("access.matrix.resetDone"));
      setDraft(new Map());
      setResetOpen(false);
      router.refresh();
    });

  const violationText = (v: MatrixViolation) => {
    const role = t(`roles.${v.role}`);
    if ("capabilities" in v) return t(`access.matrix.violations.${v.type}`, { role });
    return t(`access.matrix.violations.${v.type}`, { role, capability: capLabel(v.capability) });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Role summary cards: members and permission counts, live with the draft. */}
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-5">
        {ROLES.map((role) => {
          const Icon = ROLE_META[role].icon;
          const count = next[role].length;
          const delta = count - matrix[role].length;
          return (
            <li
              key={role}
              style={roleStyle(role)}
              onMouseEnter={() => setHover({ role })}
              onMouseLeave={() => setHover({})}
              className={cn(
                "min-w-44 snap-start rounded-2xl border bg-card p-3.5 transition-all duration-200",
                hover.role === role && "-translate-y-0.5 role-ring",
              )}
            >
              <div className="flex items-center gap-2.5">
                <span className="inline-flex size-9 items-center justify-center rounded-xl role-tint [&_svg]:size-[1.1rem]">
                  <Icon aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{t(`roles.${role}`)}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("access.matrix.members", { count: roleCounts[role] })}
                  </p>
                </div>
              </div>
              <p className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                {t("access.matrix.permissionCount", { count })}
                {delta !== 0 && (
                  <Badge variant={delta > 0 ? "success" : "danger"} className="px-1.5 py-0">
                    {delta > 0 ? `+${delta}` : delta}
                  </Badge>
                )}
                {isStaffRole(role) && (
                  <Badge variant="outline" className="ml-auto px-1.5 py-0">
                    {t("access.matrix.staffRole")}
                  </Badge>
                )}
              </p>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-80">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("access.matrix.search")}
            aria-label={t("access.matrix.search")}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CellDot granted /> {t("access.matrix.legend.granted")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CellDot granted={false} /> {t("access.matrix.legend.denied")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-accent-foreground" />{" "}
            {t("access.matrix.legend.modified")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Lock className="size-3" /> {t("access.matrix.legend.locked")}
          </span>
          {canEdit && hasOverrides && (
            <Button variant="ghost" size="sm" onClick={() => setResetOpen(true)}>
              <RotateCcw /> {t("access.matrix.resetDefaults")}
            </Button>
          )}
        </div>
      </div>

      {visible.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">
          {t("access.matrix.noMatches", { query: filter })}
        </p>
      )}

      {/* Desktop grid */}
      {visible.length > 0 && (
        <div
          className="hidden overflow-auto rounded-2xl border bg-card md:block md:max-h-[70dvh]"
          data-testid="permission-matrix"
        >
          <table
            className="w-full border-separate border-spacing-0 text-sm"
            onMouseLeave={() => setHover({})}
          >
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky top-0 left-0 z-30 min-w-52 border-b bg-card p-3 text-left align-bottom xl:min-w-60"
                >
                  <span className="sr-only">{t("access.matrix.title")}</span>
                </th>
                {ROLES.map((role) => {
                  const Icon = ROLE_META[role].icon;
                  return (
                    <th
                      key={role}
                      scope="col"
                      style={roleStyle(role)}
                      onMouseEnter={() => setHover({ role })}
                      className={cn(
                        "sticky top-0 z-20 min-w-[4.75rem] border-b bg-card px-1 py-3 align-bottom transition-colors",
                        hover.role === role && "bg-muted",
                      )}
                    >
                      <span className="flex flex-col items-center gap-1.5">
                        <span className="inline-flex size-8 items-center justify-center rounded-xl role-tint [&_svg]:size-4">
                          <Icon aria-hidden />
                        </span>
                        <span className="text-center text-[0.7rem] leading-tight font-semibold">
                          {t(`roles.${role}`)}
                        </span>
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            {CAPABILITY_GROUPS.map((group) => {
              const caps = visible.filter((c) => CAPABILITY_META[c].group === group);
              if (caps.length === 0) return null;
              return (
                <tbody key={group}>
                  <tr>
                    <th
                      scope="colgroup"
                      colSpan={ROLES.length + 1}
                      className="bg-muted/70 py-2 text-left text-[0.7rem] font-bold tracking-wider text-muted-foreground uppercase"
                    >
                      {/* The label (not the full-width cell) is sticky, so it stays put when scrolling sideways. */}
                      <span className="sticky left-3 px-3">{t(`capabilityGroups.${group}`)}</span>
                    </th>
                  </tr>
                  {caps.map((cap) => (
                    <tr key={cap} className="group/row">
                      <th
                        scope="row"
                        onMouseEnter={() => setHover({ cap })}
                        className={cn(
                          "sticky left-0 z-10 border-b bg-card p-3 text-left font-normal transition-colors",
                          hover.cap === cap && "bg-muted",
                        )}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help font-semibold decoration-dotted underline-offset-4 hover:underline">
                              {capLabel(cap)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="right">{capDescription(cap)}</TooltipContent>
                        </Tooltip>
                        <span className="block font-mono text-[0.7rem] text-muted-foreground">
                          {cap}
                        </span>
                      </th>
                      {ROLES.map((role) => (
                        <MatrixCell
                          key={role}
                          role={role}
                          cap={cap}
                          granted={next[role].includes(cap)}
                          drafted={draft.has(cellId(role, cap))}
                          modified={
                            next[role].includes(cap) !== DEFAULT_PERMISSIONS[role].includes(cap)
                          }
                          invalid={badCells.has(cellId(role, cap))}
                          highlighted={hover.role === role || hover.cap === cap}
                          canEdit={canEdit}
                          label={t("access.matrix.cellLabel", {
                            capability: capLabel(cap),
                            role: t(`roles.${role}`),
                          })}
                          lockText={(lock) => t(`access.matrix.locked.${lock}`)}
                          onHover={() => setHover({ role, cap })}
                          onToggle={() => toggle(role, cap)}
                        />
                      ))}
                    </tr>
                  ))}
                </tbody>
              );
            })}
          </table>
        </div>
      )}

      {/* Mobile: one role at a time */}
      {visible.length > 0 && (
        <div className="flex flex-col gap-3 md:hidden">
          <div
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
            role="tablist"
            aria-label={t("access.matrix.chooseRole")}
          >
            {ROLES.map((role) => (
              <button
                key={role}
                type="button"
                role="tab"
                aria-selected={mobileRole === role}
                onClick={() => setMobileRole(role)}
                style={roleStyle(role)}
                className={cn(
                  "shrink-0 rounded-full border-2 transition-all",
                  mobileRole === role ? "role-ring" : "border-transparent opacity-70",
                )}
              >
                <RoleChip role={role} size="md" />
              </button>
            ))}
          </div>
          <ul className="flex flex-col divide-y rounded-2xl border bg-card" role="tabpanel">
            {visible.map((cap) => {
              const lock = cellLock(mobileRole, cap);
              const granted = next[mobileRole].includes(cap);
              const invalid = badCells.has(cellId(mobileRole, cap));
              return (
                <li
                  key={cap}
                  className={cn("flex items-center gap-3 p-3.5", invalid && "bg-danger-soft")}
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      {capLabel(cap)}
                      {draft.has(cellId(mobileRole, cap)) && (
                        <Sparkles className="size-3.5 text-accent-foreground" aria-hidden />
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {lock ? t(`access.matrix.locked.${lock}`) : capDescription(cap)}
                    </p>
                  </div>
                  {lock ? (
                    <Lock
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-label={t("access.matrix.legend.locked")}
                    />
                  ) : (
                    <Switch
                      checked={granted}
                      disabled={!canEdit}
                      onCheckedChange={() => toggle(mobileRole, cap)}
                      aria-label={t("access.matrix.cellLabel", {
                        capability: capLabel(cap),
                        role: t(`roles.${mobileRole}`),
                      })}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Floating save bar */}
      {canEdit && (
        <div
          className={cn(
            "pointer-events-none sticky bottom-4 z-30 flex justify-center transition-all duration-300",
            changes.length
              ? "visible translate-y-0 opacity-100"
              : "invisible translate-y-6 opacity-0",
          )}
        >
          <div className="pointer-events-auto flex w-full max-w-xl items-center gap-2 rounded-2xl bg-foreground p-2 pl-4 text-background shadow-2xl">
            <span
              className="flex-1 text-sm font-semibold"
              aria-live="polite"
              data-testid="matrix-change-count"
            >
              {t("access.matrix.changes", { count: changes.length })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-background hover:bg-background/10"
              onClick={() => setDraft(new Map())}
              tabIndex={changes.length ? 0 : -1}
            >
              {t("access.matrix.discard")}
            </Button>
            <Button
              size="sm"
              variant="accent"
              onClick={() => setReviewOpen(true)}
              tabIndex={changes.length ? 0 : -1}
            >
              {t("access.matrix.review")}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("access.matrix.reviewTitle")}</DialogTitle>
            <DialogDescription>{t("access.matrix.reviewBody")}</DialogDescription>
          </DialogHeader>
          <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto" data-testid="matrix-review">
            {changes.map((c) => (
              <li
                key={cellId(c.role, c.capability)}
                className="flex flex-wrap items-center gap-2 rounded-xl border p-2.5 text-sm"
              >
                <Badge variant={c.granted ? "success" : "danger"}>
                  {c.granted ? t("access.matrix.grant") : t("access.matrix.revoke")}
                </Badge>
                <span className="font-semibold">{capLabel(c.capability)}</span>
                <RoleChip role={c.role} className="ml-auto" />
              </li>
            ))}
          </ul>
          {violations.length > 0 && (
            <Alert variant="danger" title={t("errors.matrixInvalid")}>
              <ul className="list-disc pl-4" data-testid="matrix-violations">
                {violations.map((v, i) => (
                  <li key={i}>{violationText(v)}</li>
                ))}
              </ul>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={save} loading={saving} disabled={violations.length > 0}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("access.matrix.resetTitle")}</DialogTitle>
            <DialogDescription>{t("access.matrix.resetBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={reset} loading={saving}>
              {t("access.matrix.resetDefaults")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CellDot({ granted }: { granted: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex size-4 items-center justify-center rounded-full",
        granted ? "bg-primary text-primary-foreground" : "border-2 border-dashed border-input",
      )}
    >
      {granted && <Check className="size-2.5" strokeWidth={3.5} />}
    </span>
  );
}

interface MatrixCellProps {
  role: Role;
  cap: Capability;
  granted: boolean;
  drafted: boolean;
  modified: boolean;
  invalid: boolean;
  highlighted: boolean;
  canEdit: boolean;
  label: string;
  lockText: (lock: "required" | "staffOnly") => string;
  onHover: () => void;
  onToggle: () => void;
}

function MatrixCell({
  role,
  cap,
  granted,
  drafted,
  modified,
  invalid,
  highlighted,
  canEdit,
  label,
  lockText,
  onHover,
  onToggle,
}: MatrixCellProps) {
  const lock = cellLock(role, cap);
  const content = (
    <button
      type="button"
      role="switch"
      aria-checked={granted}
      aria-label={label}
      aria-disabled={!canEdit || Boolean(lock)}
      data-testid={`cell-${role}-${cap}`}
      onClick={onToggle}
      className={cn(
        "relative mx-auto inline-flex size-9 items-center justify-center rounded-xl transition-all duration-200 outline-none",
        "focus-visible:ring-[3px] focus-visible:ring-ring/40",
        canEdit && !lock && "cursor-pointer hover:bg-muted active:scale-90",
        (!canEdit || lock) && "cursor-default",
        drafted && "bg-accent ring-2 ring-accent-foreground/30",
        invalid && "bg-danger-soft ring-2 ring-destructive",
      )}
    >
      {lock && !granted ? (
        <Lock className="size-3.5 text-muted-foreground/60" aria-hidden />
      ) : (
        <span
          className={cn(
            "inline-flex size-6 items-center justify-center rounded-full transition-all duration-200",
            granted
              ? "scale-100 bg-primary text-primary-foreground"
              : "scale-90 border-2 border-dashed border-input",
            lock && "opacity-60",
          )}
        >
          {granted &&
            (lock ? (
              <Lock className="size-3" aria-hidden />
            ) : (
              <Check className="size-3.5" strokeWidth={3} aria-hidden />
            ))}
        </span>
      )}
      {modified && !drafted && (
        <span
          className="absolute top-1 right-1 size-1.5 rounded-full bg-accent-foreground"
          aria-hidden
        />
      )}
    </button>
  );

  return (
    <td
      onMouseEnter={onHover}
      className={cn("border-b p-1 text-center transition-colors", highlighted && "bg-muted/60")}
    >
      {lock ? (
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent>{lockText(lock)}</TooltipContent>
        </Tooltip>
      ) : (
        content
      )}
    </td>
  );
}
