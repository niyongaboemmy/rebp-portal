"use client";

import { Check, ChevronDown, ScrollText, X, type LucideIcon } from "@/components/icons";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";

export interface DigestItem {
  icon: LucideIcon;
  /** i18n key (under the digest's namespace). */
  key: string;
}

/**
 * A legal article as something to glance at, not read (FR-G1-005, FR-G2-006): what you can do
 * (green tiles) and what you can't (red tiles), one icon and a few words each. The full article
 * stays one tap away for the record; the acknowledgment below it is unchanged.
 */
export function RuleDigest({
  namespace,
  can,
  cannot = [],
  fullText,
}: {
  /** e.g. "wizard.g.g1.digest" — items are `${namespace}.${key}`. */
  namespace: string;
  can: DigestItem[];
  cannot?: DigestItem[];
  fullText: string;
}) {
  const t = useTranslations("wizard.digest");
  const td = useTranslations(namespace as "wizard.g");
  const [open, setOpen] = useState(false);
  const columns = [
    { kind: "can" as const, items: can },
    { kind: "cannot" as const, items: cannot },
  ].filter((c) => c.items.length > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className={cn("grid gap-3", columns.length > 1 && "sm:grid-cols-2")}>
        {columns.map(({ kind, items }) => (
          <div
            key={kind}
            className={cn(
              "flex flex-col gap-2 rounded-2xl p-3",
              kind === "can" ? "bg-primary-soft/60" : "bg-danger-soft/60",
            )}
          >
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-1 text-xs font-bold tracking-wide uppercase",
                kind === "can" ? "text-link" : "text-destructive",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-4 items-center justify-center rounded-full text-white",
                  kind === "can" ? "bg-primary" : "bg-destructive",
                )}
              >
                {kind === "can" ? (
                  <Check className="size-3" strokeWidth={3} aria-hidden />
                ) : (
                  <X className="size-3" strokeWidth={3} aria-hidden />
                )}
              </span>
              {t(kind)}
            </span>
            <ul className="grid gap-1.5">
              {items.map(({ icon: Icon, key }, i) => (
                <li
                  key={key}
                  className="flex animate-rise items-center gap-3 rounded-xl bg-card p-2.5 text-sm font-medium dark:bg-surface-2"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <span
                    className={cn(
                      "inline-flex size-8 shrink-0 items-center justify-center rounded-lg",
                      kind === "can"
                        ? "bg-primary-soft text-link"
                        : "bg-danger-soft text-destructive",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </span>
                  {td(key as never)}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex w-fit items-center gap-1.5 rounded-full px-1 text-xs font-semibold text-link hover:underline"
      >
        <ScrollText className="size-3.5" aria-hidden />
        {open ? t("hideFull") : t("readFull")}
        <ChevronDown
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && (
        <div className="max-h-56 animate-rise overflow-auto rounded-2xl bg-card p-4 text-sm leading-relaxed whitespace-pre-line text-muted-foreground ring-1 ring-foreground/[0.06] [animation-duration:var(--dur-3)] dark:bg-surface-2/70 dark:ring-white/[0.06]">
          {fullText}
        </div>
      )}
    </div>
  );
}
