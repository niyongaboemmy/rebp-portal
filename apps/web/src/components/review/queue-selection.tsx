"use client";

import { Select } from "@/components/ui/select";
import { UserPlus, X } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createContext, useContext, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useErrorMessage } from "@/hooks/use-error-message";
import { cn } from "@/lib/utils";
import { bulkAssignAction } from "@/server/actions/backoffice";
import type { OfficerOption } from "./assign-dialog";

interface SelectionState {
  selectable: readonly string[];
  selected: ReadonlySet<string>;
  toggle: (id: string, on: boolean) => void;
  setAll: (on: boolean) => void;
}

const SelectionContext = createContext<SelectionState | null>(null);

function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("Queue selection controls must be inside <QueueSelection>");
  return ctx;
}

/**
 * FR-BO-005 bulk assign: rows of the current page can be selected (select-all included) and
 * assigned to one officer in one confirmed action. Team leads (review.assign) choose any officer;
 * officers take unassigned files themselves. The server re-checks every file (BR-093) and the
 * toast names each one it skipped and why.
 */
export function QueueSelection({
  selectable,
  officers,
  selfId,
  canLead,
  children,
}: {
  /** Ids of the rows this person may (re)assign. */
  selectable: string[];
  officers: OfficerOption[];
  selfId: string;
  canLead: boolean;
  children: React.ReactNode;
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const value = useMemo<SelectionState>(
    () => ({
      selectable,
      // Rows that left the page (after a refresh) drop out of the selection.
      selected: new Set([...selected].filter((id) => selectable.includes(id))),
      toggle: (id, on) =>
        setSelected((prev) => {
          const next = new Set(prev);
          if (on) next.add(id);
          else next.delete(id);
          return next;
        }),
      setAll: (on) => setSelected(on ? new Set(selectable) : new Set()),
    }),
    [selectable, selected],
  );
  return (
    <SelectionContext.Provider value={value}>
      {selectable.length > 0 && <BulkBar officers={officers} selfId={selfId} canLead={canLead} />}
      {children}
    </SelectionContext.Provider>
  );
}

/** The checkbox on one row; rows this person can't assign show none (keeps the layout). */
export function QueueRowCheck({ id, reference }: { id: string; reference: string }) {
  const t = useTranslations("queue.bulk");
  const { selectable, selected, toggle } = useSelection();
  const enabled = selectable.includes(id);
  return (
    <span className="flex size-6 shrink-0 items-center justify-center">
      {enabled && (
        <Checkbox
          checked={selected.has(id)}
          onCheckedChange={(on) => toggle(id, on === true)}
          aria-label={t("select", { reference })}
          data-testid={`queue-select-${reference}`}
        />
      )}
    </span>
  );
}

function BulkBar({
  officers,
  selfId,
  canLead,
}: {
  officers: OfficerOption[];
  selfId: string;
  canLead: boolean;
}) {
  const t = useTranslations("queue.bulk");
  const ta = useTranslations("queue.assign");
  const tq = useTranslations("queue.conflictReasons");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const { selectable, selected, setAll } = useSelection();
  const [busy, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const choices = canLead ? officers : officers.filter((o) => o.id === selfId);
  const [officerId, setOfficerId] = useState(
    choices.some((o) => o.id === selfId) ? selfId : (choices[0]?.id ?? ""),
  );
  const count = selected.size;
  const all = count > 0 && count === selectable.length;
  const officerName = (id: string) => {
    const officer = choices.find((o) => o.id === id);
    if (!officer) return "";
    return officer.id === selfId ? ta("me", { name: officer.fullName }) : officer.fullName;
  };

  const run = () =>
    startTransition(async () => {
      const result = await bulkAssignAction({ applicationIds: [...selected], officerId });
      setConfirming(false);
      if (!result.ok) return void toast.error(errorMessage(result.error, result.meta));
      const { assigned, skipped } = result.data;
      if (assigned.length > 0) toast.success(t("done", { count: assigned.length }));
      if (skipped.length > 0)
        toast.warning(t("skipped", { count: skipped.length }), {
          description: (
            <ul className="flex flex-col gap-0.5" data-testid="bulk-skipped">
              {skipped.map((s) => (
                <li key={s.reference}>
                  <span className="font-mono font-semibold">{s.reference}</span> —{" "}
                  {s.reasons.length > 0
                    ? s.reasons
                        .map((r) => (tq.has(r) ? tq(r as "firm") : errorMessage(s.error)))
                        .join(" ")
                    : errorMessage(s.error)}
                </li>
              ))}
            </ul>
          ),
          duration: 12_000,
        });
      setAll(false);
      router.refresh();
    });

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl px-4 py-3 ring-1 ring-primary/[0.08] @2xl/main:flex-row @2xl/main:items-center dark:ring-white/[0.06]",
        count > 0 ? "bg-primary/[0.06] dark:bg-primary/[0.14]" : "glass",
      )}
      role="group"
      aria-label={t("label")}
      data-testid="queue-bulk"
    >
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
        <Checkbox
          checked={all ? true : count > 0 ? "indeterminate" : false}
          onCheckedChange={(on) => setAll(on === true)}
          aria-label={t("selectAll")}
          data-testid="queue-select-all"
        />
        <span aria-live="polite">{count > 0 ? t("selected", { count }) : t("selectAll")}</span>
      </label>
      <div
        className={cn(
          "flex flex-col gap-2 @2xl/main:ml-auto @2xl/main:flex-row @2xl/main:items-center",
          count === 0 && "invisible",
        )}
        aria-hidden={count === 0}
      >
        {canLead ? (
          <>
            <label className="sr-only" htmlFor="bulk-officer">
              {t("officer")}
            </label>
            <Select
              id="bulk-officer"
              value={officerId}
              onChange={(v) => v && setOfficerId(v)}
              className="w-full @2xl/main:w-60"
              tabIndex={count === 0 ? -1 : undefined}
              options={choices.map((o) => ({ value: o.id, label: officerName(o.id) }))}
            />
          </>
        ) : null}
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => setConfirming(true)}
            disabled={count === 0 || !officerId}
            tabIndex={count === 0 ? -1 : undefined}
            data-testid="bulk-assign"
          >
            <UserPlus /> {canLead ? t("assign") : t("takeSelected")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setAll(false)}
            tabIndex={count === 0 ? -1 : undefined}
          >
            <X /> {t("clear")}
          </Button>
        </div>
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmTitle", { count })}</DialogTitle>
            <DialogDescription>
              {t("confirmBody", { count, name: officerName(officerId) })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              {t("cancel")}
            </Button>
            <Button loading={busy} onClick={run} data-testid="bulk-assign-confirm">
              <UserPlus /> {t("confirm", { count })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
