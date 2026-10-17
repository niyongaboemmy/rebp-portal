"use client";

import {
  ArrowRight,
  Building2,
  ChevronDown,
  ListChecks,
  MessageSquare,
  Sparkles,
  Timeline,
} from "@/components/icons";
import type { Route } from "next";
import Link from "next/link";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";

const ICONS = { which: ListChecks, upgrade: Timeline, firm: Building2 } as const;

export interface FaqItem {
  key: keyof typeof ICONS;
  q: string;
  a: string;
  action: { label: string; href: string };
}

/**
 * Categories FAQ (FR-PORTAL-007): one answer open at a time, the first open on arrival. Each row
 * has its number and an icon; opening it glides the answer open (height via grid rows, no
 * jumps), tints the row and offers a next step. Real buttons with aria-expanded/controls, so it
 * works by keyboard and screen reader. Beside it, a help card points to the eligibility check.
 */
export function CategoryFaq({
  eyebrow,
  title,
  body,
  items,
  help,
}: {
  eyebrow: string;
  title: React.ReactNode;
  body: string;
  items: FaqItem[];
  help: { title: string; body: string; cta: string };
}) {
  const [open, setOpen] = useState<string | null>(items[0]?.key ?? null);
  const base = useId();

  return (
    <section aria-labelledby="faq-title" className="grid gap-8 lg:grid-cols-[1fr_1.6fr] lg:gap-12">
      <div className="flex flex-col gap-5 lg:sticky lg:top-28 lg:self-start">
        <div className="flex flex-col gap-3">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary-soft-foreground">
            <MessageSquare className="size-3.5" aria-hidden />
            {eyebrow}
          </span>
          {title}
          <p className="max-w-sm text-muted-foreground">{body}</p>
        </div>
        {/* Help card. */}
        <div className="relative isolate flex flex-col gap-3 overflow-hidden rounded-3xl bg-[linear-gradient(140deg,var(--primary),color-mix(in_oklch,var(--primary)_60%,var(--sky)))] p-5 text-primary-foreground shadow-[0_24px_50px_-28px_oklch(0.4_0.2_264/0.8)] dark:bg-[linear-gradient(140deg,color-mix(in_oklch,var(--primary)_40%,oklch(0.18_0.03_265)),oklch(0.17_0.025_265))] dark:text-foreground dark:shadow-none dark:ring-1 dark:ring-primary/25">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-imigongo opacity-[0.12] dark:opacity-[0.05]"
          />
          <div
            aria-hidden
            className="absolute -top-10 -right-10 -z-10 size-40 rounded-full bg-sun/30 blur-2xl dark:bg-primary/35"
          />
          <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-white/15 backdrop-blur dark:bg-primary/25 dark:text-sky">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-lg font-bold">{help.title}</p>
            <p className="text-sm text-primary-foreground/85 dark:text-muted-foreground">
              {help.body}
            </p>
          </div>
          <Link
            href={"/eligibility" as Route}
            className="group mt-1 inline-flex h-10 w-fit items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-primary transition-transform hover:scale-[1.02] active:scale-[0.98] dark:bg-primary dark:text-primary-foreground"
          >
            {help.cta}
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-1"
              aria-hidden
            />
          </Link>
        </div>
      </div>

      <ol className="flex flex-col gap-3">
        {items.map((item, i) => {
          const Icon = ICONS[item.key];
          const isOpen = open === item.key;
          const panel = `${base}-${item.key}`;
          return (
            <li
              key={item.key}
              className={cn(
                "group/faq animate-rise rounded-3xl transition-[background-color,box-shadow] duration-(--dur-3)",
                isOpen
                  ? "bg-card shadow-[0_1px_2px_oklch(0.3_0.08_264/0.06),0_20px_44px_-26px_oklch(0.35_0.15_264/0.45)] ring-1 ring-primary/20 dark:bg-white/[0.06] dark:shadow-none dark:ring-primary/30"
                  : "bg-foreground/[0.03] hover:bg-foreground/[0.05] dark:bg-white/[0.03] dark:hover:bg-white/[0.05]",
              )}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <h3>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panel}
                  onClick={() => setOpen(isOpen ? null : item.key)}
                  className="flex w-full items-center gap-4 rounded-3xl p-4 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 sm:p-5"
                >
                  <span
                    className={cn(
                      "inline-flex size-11 shrink-0 items-center justify-center rounded-2xl transition-[background-color,color,transform] duration-(--dur-3) ease-spring",
                      isOpen
                        ? "-rotate-6 bg-primary text-primary-foreground"
                        : "bg-primary-soft text-link group-hover/faq:-rotate-3 dark:bg-white/[0.06]",
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-mono text-[0.7rem] font-bold text-muted-foreground">
                      0{i + 1}
                    </span>
                    <span className="text-base font-semibold sm:text-lg">{item.q}</span>
                  </span>
                  <ChevronDown
                    aria-hidden
                    className={cn(
                      "size-5 shrink-0 text-muted-foreground transition-transform duration-(--dur-3) ease-spring",
                      isOpen && "rotate-180 text-link",
                    )}
                  />
                </button>
              </h3>
              <div
                id={panel}
                role="region"
                aria-hidden={!isOpen}
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-(--dur-3) ease-(--ease-enter)",
                  isOpen ? "grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0",
                )}
              >
                <div className="overflow-hidden">
                  <div className="flex flex-col gap-4 px-4 pb-5 sm:pr-14 sm:pl-[5.25rem]">
                    <p className="leading-relaxed text-muted-foreground">{item.a}</p>
                    <Link
                      href={item.action.href as Route}
                      tabIndex={isOpen ? undefined : -1}
                      className="group/a inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-link"
                    >
                      {item.action.label}
                      <ArrowRight
                        className="size-4 transition-transform group-hover/a:translate-x-1"
                        aria-hidden
                      />
                    </Link>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
