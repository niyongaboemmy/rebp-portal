"use client";

import {
  ArrowRight,
  ClipboardCheck,
  FileStack,
  Gavel,
  History,
  Play,
  ScanSearch,
  Inbox,
  UserCheck,
  type LucideIcon,
} from "@/components/icons";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { useErrorMessage } from "@/hooks/use-error-message";
import { cn } from "@/lib/utils";
import { assignAction, startReviewAction } from "@/server/actions/backoffice";
import { CONSOLE_TAB_EVENT, openConsoleTab, type ConsoleTabKey } from "./console-tabs";

export type NextAction =
  | { kind: "take"; applicationId: string; selfId: string }
  | { kind: "start"; applicationId: string }
  | { kind: "verify"; left: number }
  | { kind: "record"; done: number; total: number }
  | { kind: "waiting" }
  | { kind: "confirmations" }
  | { kind: "decide"; applicationId: string }
  | { kind: "signed" }
  /** This file is done here (review signed, the approver decides): open the next one. */
  | { kind: "nextFile"; applicationId?: string };

const ICON: Record<NextAction["kind"], LucideIcon> = {
  take: UserCheck,
  start: Play,
  verify: FileStack,
  record: ClipboardCheck,
  waiting: History,
  confirmations: ScanSearch,
  decide: Gavel,
  signed: ClipboardCheck,
  nextFile: Inbox,
};

/** Where an action that only points somewhere takes the officer. */
const TAB: Partial<Record<NextAction["kind"], ConsoleTabKey>> = {
  verify: "documents",
  record: "review",
  waiting: "history",
  confirmations: "checks",
  signed: "review",
};

/**
 * The one next step, always in reach (UX-036): a floating button at the bottom right with a
 * pulsing ring, the step's icon and a word or two. It does the step (assign, start) or takes the
 * officer to where the step happens (a tab, the next document, the decision). While the review
 * form is open its own floating bar carries the actions, so this one steps aside.
 */
export function NextActionDock({
  action,
  hideOn,
  initialTab,
}: {
  action: NextAction;
  hideOn?: ConsoleTabKey;
  /** The tab the console opens on (its first "changed" event may fire before this listens). */
  initialTab?: ConsoleTabKey;
}) {
  const t = useTranslations("review.dock");
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [busy, start] = useTransition();
  const [tab, setTab] = useState<ConsoleTabKey | null>(initialTab ?? null);

  useEffect(() => {
    const on = (e: Event) => setTab((e as CustomEvent<ConsoleTabKey>).detail);
    window.addEventListener(`${CONSOLE_TAB_EVENT}:changed`, on);
    return () => window.removeEventListener(`${CONSOLE_TAB_EVENT}:changed`, on);
  }, []);

  if (hideOn && tab === hideOn) return null;

  const Icon = ICON[action.kind];
  const label = t(
    action.kind === "nextFile" && !action.applicationId ? "nextFile.queue" : `${action.kind}.label`,
    {
      left: "left" in action ? action.left : 0,
      done: "done" in action ? action.done : 0,
      total: "total" in action ? action.total : 0,
    },
  );
  const run = () => {
    if (action.kind === "take")
      return start(async () => {
        const r = await assignAction({
          applicationId: action.applicationId,
          officerId: action.selfId,
        });
        if (!r.ok) return void toast.error(errorMessage(r.error));
        toast.success(t("take.done"));
        router.refresh();
      });
    if (action.kind === "start")
      return start(async () => {
        const r = await startReviewAction(action.applicationId);
        if (!r.ok) return void toast.error(errorMessage(r.error));
        toast.success(t("start.done"));
        router.refresh();
      });
    if (action.kind === "verify") {
      openConsoleTab("documents");
      // The documents list opens the first one still to check in the carousel.
      window.setTimeout(() => window.dispatchEvent(new Event("review-console:next-document")), 350);
      return;
    }
    const target = TAB[action.kind];
    if (target) openConsoleTab(target, action.kind === "record" ? "review-form" : undefined);
  };

  const body = (
    <>
      {/* The step's icon in a ring that breathes, so the eye finds it. */}
      <span className="relative inline-flex size-11 shrink-0 items-center justify-center">
        <span
          aria-hidden
          className="absolute inset-0 animate-ping rounded-full bg-primary-foreground/25 [animation-duration:2.2s]"
        />
        <span className="relative inline-flex size-11 items-center justify-center rounded-full bg-primary-foreground/15">
          <Icon className={cn("size-5", busy && "animate-pulse")} aria-hidden />
        </span>
      </span>
      <span className="flex min-w-0 flex-col pr-1 text-left">
        <span aria-hidden className="text-[0.65rem] font-bold tracking-widest uppercase opacity-75">
          {action.kind === "nextFile" ? t("nextFile.eyebrow") : t("eyebrow")}
        </span>
        <span className="truncate text-sm font-semibold">{label}</span>
      </span>
      <ArrowRight
        aria-hidden
        className="size-4 shrink-0 transition-transform group-hover:translate-x-1"
      />
    </>
  );
  const className =
    "group fixed right-4 bottom-[calc(var(--bottom-nav-h,0px)+1rem)] z-30 flex max-w-[calc(100vw-2rem)] animate-in items-center gap-3 rounded-full bg-primary py-2 pr-4 pl-2 text-primary-foreground ring-4 ring-primary/15 transition-transform duration-(--dur-3) ease-(--ease-spring) fade-in slide-in-from-bottom-6 hover:-translate-y-0.5 active:scale-95 disabled:opacity-70 sm:right-6 sm:bottom-6";

  const href =
    action.kind === "decide"
      ? `/backoffice/decisions/${action.applicationId}`
      : action.kind === "nextFile"
        ? action.applicationId
          ? `/backoffice/review/${action.applicationId}`
          : "/backoffice/queue"
        : null;
  return href ? (
    <Link href={href as Route} aria-label={label} data-testid="next-action" className={className}>
      {body}
    </Link>
  ) : (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      aria-label={label}
      data-testid="next-action"
      className={className}
    >
      {body}
    </button>
  );
}
