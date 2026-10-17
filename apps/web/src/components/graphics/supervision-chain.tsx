"use client";

import { useTranslations } from "next-intl";
import { Building2, Check, Handshake, User, UserCheck } from "@/components/icons";
import { cn } from "@/lib/utils";

export type LinkState = "empty" | "checking" | "ok" | "fail" | "officer";

/**
 * Who you work through and who supervises you (FR-F-007, BR-030), as one picture: you in the
 * middle, the firm (or referral scheme) on one side, the supervisor on the other. A link draws
 * in when its answer passes, turns red when a rule fails and stays dashed until answered. The
 * figcaption says the same in words, so the picture is never the only channel (WCAG 1.1.1).
 */
export function SupervisionChain({
  through,
  throughLabel,
  throughState,
  supervisorLabel,
  supervisorState,
  onThrough,
  onSupervisor,
}: {
  through: "firm" | "referral";
  throughLabel?: string | null;
  throughState: LinkState;
  supervisorLabel?: string | null;
  supervisorState: LinkState;
  /** Tapping a node goes to its answer (UX-023). */
  onThrough?: () => void;
  onSupervisor?: () => void;
}) {
  const t = useTranslations("wizard.chain");
  const ThroughIcon = through === "firm" ? Building2 : Handshake;
  const summary = [
    t(`through.${throughState}`, {
      name: throughLabel ?? t(through === "firm" ? "firm" : "referral"),
    }),
    t(`supervisor.${supervisorState}`, { name: supervisorLabel ?? t("supervisorNode") }),
  ].join(" ");

  return (
    <figure
      data-graphic="supervision-chain"
      className="rounded-2xl bg-[linear-gradient(160deg,color-mix(in_oklch,var(--primary)_6%,var(--card)),var(--card)_70%)] px-3 py-4 ring-1 ring-primary/10 sm:px-5 dark:bg-surface-2/70 dark:ring-white/[0.06]"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(1.5rem,4rem)_auto_minmax(1.5rem,4rem)_minmax(0,1fr)] items-center gap-1.5">
        <Node
          icon={<ThroughIcon className="size-4" aria-hidden />}
          label={throughLabel ?? t(through === "firm" ? "firm" : "referral")}
          state={throughState}
          onClick={onThrough}
        />
        <Link state={throughState} />
        <span className="flex flex-col items-center gap-1">
          <span className="inline-flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_20px_-10px_var(--primary)]">
            <User className="size-5" aria-hidden />
          </span>
          <span className="text-xs font-semibold">{t("you")}</span>
        </span>
        <Link state={supervisorState} />
        <Node
          icon={<UserCheck className="size-4" aria-hidden />}
          label={supervisorLabel ?? t("supervisorNode")}
          state={supervisorState}
          onClick={onSupervisor}
        />
      </div>
      {/* The picture says it at a glance; screen readers get it in words. */}
      <figcaption className="sr-only">
        {summary} {supervisorState === "ok" ? t("confirmsLater") : t("caption")}
      </figcaption>
    </figure>
  );
}

/** A node: its picture with a status mark, its name, and one word for its state; a button to its answer. */
function Node({
  icon,
  label,
  state,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  state: LinkState;
  onClick?: () => void;
}) {
  const t = useTranslations("wizard.chain.state");
  const body = (
    <>
      <span
        className={cn(
          "relative inline-flex size-11 items-center justify-center rounded-full transition-[background-color,transform] duration-(--dur-3) group-hover/node:scale-105",
          state === "ok" && "bg-primary-soft text-link",
          state === "fail" && "bg-danger-soft text-destructive",
          state === "officer" && "bg-primary-soft text-link",
          (state === "empty" || state === "checking") &&
            "border border-dashed border-foreground/20 bg-card text-muted-foreground dark:bg-surface-2",
        )}
      >
        {icon}
        {(state === "ok" || state === "fail") && (
          <span
            className={cn(
              "absolute -right-0.5 -bottom-0.5 inline-flex size-4 items-center justify-center rounded-full text-white ring-2 ring-card",
              state === "ok" ? "bg-card text-link ring-primary/40" : "bg-destructive text-white",
            )}
          >
            {state === "ok" ? (
              <Check className="size-2.5" strokeWidth={2.5} />
            ) : (
              <span className="text-[0.6rem] font-bold">!</span>
            )}
          </span>
        )}
      </span>
      <span
        className={cn(
          "max-w-full truncate text-xs",
          state === "empty" ? "text-muted-foreground" : "font-semibold",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "rounded-full px-1.5 text-[0.65rem] font-semibold",
          state === "fail"
            ? "bg-danger-soft text-destructive"
            : state === "ok"
              ? "text-link"
              : "text-muted-foreground",
        )}
      >
        {t(state)}
      </span>
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${t(state)}`}
      className="group/node flex min-w-0 flex-col items-center gap-1 rounded-2xl p-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
    >
      {body}
    </button>
  ) : (
    <span className="flex min-w-0 flex-col items-center gap-1" aria-hidden>
      {body}
    </span>
  );
}

/** The link: dashed while open, drawn in once it holds (`animate-draw`), red when it fails. */
function Link({ state }: { state: LinkState }) {
  const solid = state === "ok" || state === "fail" || state === "officer";
  return (
    <svg viewBox="0 0 100 8" preserveAspectRatio="none" className="-mt-5 h-2 w-full" aria-hidden>
      <line
        x1="2"
        y1="4"
        x2="98"
        y2="4"
        strokeWidth="2.5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        className={cn(
          "graphic-link",
          state === "ok" && "animate-draw stroke-primary",
          state === "fail" && "stroke-destructive",
          state === "officer" && "stroke-primary/60",
          state === "checking" && "animate-pulse stroke-foreground/30",
          state === "empty" && "stroke-foreground/20",
        )}
        strokeDasharray={solid ? "100" : "5 6"}
        style={{ "--draw-length": 100 } as React.CSSProperties}
      />
    </svg>
  );
}
