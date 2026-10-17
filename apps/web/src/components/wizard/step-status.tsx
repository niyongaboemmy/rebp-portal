"use client";

import { ArrowRight } from "@/components/icons";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useErrorMessage } from "@/hooks/use-error-message";
import { focusField } from "./focus";
import { fieldFor } from "./section-pager";

/** A field's visible name: its question (aria-labelledby), else its label or legend. */
function nameOf(el: HTMLElement | null) {
  const labelled = el?.getAttribute("aria-labelledby");
  const source =
    (labelled && document.getElementById(labelled)) || el?.querySelector("legend, label");
  return (source?.textContent ?? "").replace(/\(.*?\)/g, "").trim();
}

/**
 * Error summary (GOV.UK pattern, FR-WIZ-006): after "Continue" with problems, a box at the top
 * of the step lists each one by its field name, and each line jumps to the field. It receives
 * focus so screen readers announce it, and shrinks live as answers are fixed.
 */
export function ErrorSummary({
  issues,
  show,
  focusKey,
}: {
  issues: Record<string, string>;
  show: boolean;
  /** Changes on each failed "Continue", to move focus to the summary again. */
  focusKey: number;
}) {
  const t = useTranslations("wizard.errors");
  const translate = useErrorMessage();
  const box = useRef<HTMLDivElement>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const paths = Object.keys(issues);

  // Field names come from the rendered labels (read after paint).
  const key = paths.join("|");
  useEffect(() => {
    if (!show) return;
    const id = requestAnimationFrame(() =>
      setNames(Object.fromEntries(key.split("|").map((p) => [p, nameOf(fieldFor(p))]))),
    );
    return () => cancelAnimationFrame(id);
  }, [key, show]);

  useEffect(() => {
    if (!show || focusKey === 0) return;
    box.current?.focus();
    box.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [focusKey, show]);

  if (!show || paths.length === 0) return null;
  // What's left as a set of tappable answers (UX-019): a count to bring to zero, each answer a
  // numbered tile that goes there.
  return (
    <div
      ref={box}
      tabIndex={-1}
      role="alert"
      aria-labelledby="error-summary-title"
      className="flex animate-rise scroll-mt-28 flex-col gap-3 rounded-2xl bg-card p-4 shadow-[0_12px_30px_-22px_oklch(0.35_0.15_264/0.45)] ring-1 ring-destructive/20 outline-none [animation-duration:var(--dur-3)] focus-visible:ring-2 focus-visible:ring-destructive/50 sm:p-5 dark:bg-surface-2/70"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl bg-danger-soft text-lg font-bold num text-destructive"
        >
          {paths.length}
        </span>
        <span className="flex flex-col">
          <span id="error-summary-title" className="font-semibold">
            {t("title", { count: paths.length })}
          </span>
          <span className="text-xs text-muted-foreground">{t("tapToGo")}</span>
        </span>
      </div>
      <ul className="grid grid-cols-1 gap-1.5 @xl/form:grid-cols-2">
        {paths.map((p, i) => (
          <li key={p}>
            <button
              type="button"
              onClick={() => focusField(p)}
              className="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ring-1 ring-foreground/[0.06] transition-[box-shadow,background-color] hover:bg-danger-soft/40 hover:ring-destructive/25 dark:ring-white/[0.07]"
            >
              <span
                aria-hidden
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-destructive text-[0.7rem] font-bold num text-white"
              >
                {i + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                {names[p] && <span className="line-clamp-2 font-semibold">{names[p]}</span>}
                <span className="truncate text-xs text-muted-foreground">
                  {issues[p] === "validation.required" && names[p]
                    ? t("required")
                    : translate(issues[p]!)}
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-destructive transition-transform group-hover:translate-x-0.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
