"use client";

import { useTranslations } from "next-intl";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import type { SectionKey } from "@rebp/contracts";
import { ChevronRight, Plus, Trash2, type LucideIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
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
import { useSection, useWizard } from "./context";
import { OPEN_ITEM_EVENT } from "./focus";

export interface ItemListHandle {
  /** Adds a new item (from the template) and opens it. */
  add: (template?: Record<string, unknown>) => void;
  open: (index: number) => void;
}

/**
 * A repeatable list (periods of practice, qualifications, disclosures, people, branches) as
 * compact rows, each opening its answers in a dialog (UX-017): the page stays short, every row
 * says at a glance what it is and whether it's complete, and "Fix" links that point inside an
 * item open it at that answer (`OPEN_ITEM_EVENT`). Answers autosave as they're typed; a new item
 * closed untouched is dropped.
 */
export function ItemList<T extends { id: string }>({
  section,
  path,
  items,
  icon: Icon,
  template,
  max = 20,
  title,
  meta,
  status,
  fields,
  labels,
  ref,
}: {
  section: SectionKey;
  path: string;
  items: T[];
  icon: LucideIcon;
  /** A new item: its id and any defaults. */
  template: () => T;
  max?: number;
  title: (item: T, index: number) => string;
  /** One line under the title: the item's key facts. */
  meta?: (item: T, index: number) => React.ReactNode;
  /** A chip after the title (e.g. "Counts toward REA"). */
  status?: (item: T, index: number) => React.ReactNode;
  fields: (item: T, index: number) => React.ReactNode;
  labels: {
    add: string;
    empty: string;
    newTitle: string;
    hint?: string;
    remove: (n: number) => string;
  };
  ref?: Ref<ItemListHandle>;
}) {
  const t = useTranslations("wizard.items");
  const tw = useTranslations("wizard");
  const translate = useErrorMessage();
  const s = useSection(section);
  const { issues, attempted } = useWizard();
  const [editing, setEditing] = useState<number | null>(null);
  const [isNew, setIsNew] = useState(false);
  /** The item just added, as it was created: dropped again if closed untouched. */
  const fresh = useRef<string | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const open = attempted(section) ? issues(section) : {};
  const problemsOf = (index: number) =>
    Object.keys(open).filter(
      (key) => key.startsWith(`${path}.${index}.`) || key === `${path}.${index}`,
    ).length;

  const add = (extra?: Record<string, unknown>) => {
    const item = { ...template(), ...extra } as T;
    fresh.current = JSON.stringify(item);
    s.set(path, [...items, item]);
    setIsNew(true);
    setEditing(items.length);
  };
  const remove = (index: number) => {
    s.set(
      path,
      items.filter((_, i) => i !== index),
    );
    setEditing(null);
  };
  const close = () => {
    if (editing !== null && fresh.current && JSON.stringify(items[editing]) === fresh.current)
      remove(editing);
    fresh.current = null;
    setIsNew(false);
    setEditing(null);
  };
  useImperativeHandle(ref, () => ({ add, open: setEditing }));

  // "Fix" on an answer inside an item: open that item.
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const onOpen = (event: Event) => {
      const target = (event.target as HTMLElement).dataset.anchor ?? "";
      const index = Number(target.slice(path.length + 1));
      if (Number.isInteger(index)) setEditing(index);
    };
    el.addEventListener(OPEN_ITEM_EVENT, onOpen);
    return () => el.removeEventListener(OPEN_ITEM_EVENT, onOpen);
  }, [path]);

  const current = editing !== null ? items[editing] : undefined;

  return (
    <div data-anchor={path} className="flex scroll-mt-28 flex-col gap-2.5 rounded-2xl">
      {items.length === 0 ? (
        s.disabled ? (
          <p className="rounded-2xl px-4 py-5 text-center text-sm text-muted-foreground ring-1 ring-foreground/[0.06]">
            {labels.empty}
          </p>
        ) : (
          // The empty list is itself the way to add the first item.
          <button
            type="button"
            onClick={() => add()}
            className="group flex flex-col items-center gap-2 rounded-2xl border border-dashed border-primary/25 px-4 py-7 text-center transition-[background-color,border-color] duration-(--dur-2) hover:border-primary/45 hover:bg-primary-soft/40"
          >
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_18px_-8px_var(--primary)] transition-transform duration-(--dur-2) group-hover:scale-105">
              <Plus className="size-5" aria-hidden />
            </span>
            <span className="text-sm font-semibold text-link">{labels.add}</span>
            <span className="max-w-sm text-xs text-muted-foreground">{labels.empty}</span>
          </button>
        )
      ) : (
        <ul ref={list} className="flex flex-col gap-2">
          {items.map((item, index) => {
            const problems = problemsOf(index);
            return (
              <li
                key={item.id}
                data-item
                data-anchor={`${path}.${index}`}
                className="group/item flex animate-rise items-center gap-1 rounded-2xl bg-card pr-1.5 shadow-[0_1px_2px_oklch(0.3_0.08_264/0.05)] ring-1 ring-foreground/[0.06] transition-[box-shadow,transform] duration-(--dur-2) hover:-translate-y-px hover:shadow-[0_10px_28px_-16px_oklch(0.35_0.15_264/0.45)] dark:bg-surface-2/70 dark:ring-white/[0.07]"
              >
                <button
                  type="button"
                  onClick={() => setEditing(index)}
                  aria-label={`${title(item, index)} · ${t("edit")}`}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-3 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 sm:p-3.5"
                >
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate text-sm font-semibold">{title(item, index)}</span>
                      {problems > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-destructive">
                          <span className="size-1.5 rounded-full bg-destructive" aria-hidden />
                          {tw("toFix", { count: problems })}
                        </span>
                      ) : (
                        status?.(item, index)
                      )}
                    </span>
                    {meta && (
                      <span className="truncate text-xs text-muted-foreground">
                        {meta(item, index)}
                      </span>
                    )}
                  </span>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform duration-(--dur-2) group-hover/item:translate-x-0.5"
                    aria-hidden
                  />
                </button>
                {!s.disabled && (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={labels.remove(index + 1)}
                    onClick={() => remove(index)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 aria-hidden />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {s.error(path) && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {/* The list's own rule (e.g. "add at least one"). */}
          {translate(s.error(path))}
        </p>
      )}

      {items.length > 0 && !s.disabled && items.length < max && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => add()}
          className="self-start rounded-full text-link hover:bg-primary-soft"
        >
          <Plus aria-hidden /> {labels.add}
        </Button>
      )}

      <Dialog open={current !== undefined} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-2xl">
          {current !== undefined && editing !== null && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2.5">
                  <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                    <Icon className="size-[1.1rem]" aria-hidden />
                  </span>
                  {isNew ? labels.newTitle : title(current, editing)}
                </DialogTitle>
                <DialogDescription className={cn(!labels.hint && "sr-only")}>
                  {labels.hint ?? t("autosave")}
                </DialogDescription>
              </DialogHeader>
              <div className="@container/form flex flex-col gap-5">{fields(current, editing)}</div>
              <DialogFooter className="items-center sm:justify-between">
                {!s.disabled ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => remove(editing)}
                    className="text-destructive hover:bg-danger-soft hover:text-destructive"
                  >
                    <Trash2 aria-hidden /> {labels.remove(editing + 1)}
                  </Button>
                ) : (
                  <span />
                )}
                <Button type="button" onClick={close} className="rounded-full max-sm:w-full">
                  {t("done")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
