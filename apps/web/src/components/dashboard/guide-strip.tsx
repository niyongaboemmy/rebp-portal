import type { Route } from "next";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CircleCheck,
  Clock3,
  Gavel,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  type LucideIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";

export type GuideTone = "critical" | "warning" | "waiting" | "good";
export type GuideIcon = "overdue" | "due" | "decide" | "backlog" | "applicant" | "security" | "ok";

export interface GuideItem {
  key: string;
  tone: GuideTone;
  icon: GuideIcon;
  /** One short line: the fact. */
  text: string;
  /** The action, and where it goes. */
  cta?: string;
  href?: Route;
}

const ICON: Record<GuideIcon, LucideIcon> = {
  overdue: TriangleAlert,
  due: Clock3,
  decide: Gavel,
  backlog: Activity,
  applicant: UserRound,
  security: ShieldCheck,
  ok: CircleCheck,
};

/** Blue-led (ADR-009 v17): calm primary tiles, yellow for what awaits you, red for overdue. */
const TONE: Record<GuideTone, { tile: string; ring: string }> = {
  critical: { tile: "bg-danger-soft text-destructive", ring: "ring-destructive/20" },
  warning: { tile: "bg-primary-soft text-primary-soft-foreground", ring: "ring-primary/15" },
  waiting: { tile: "bg-sun text-sun-foreground", ring: "ring-sun/40" },
  good: { tile: "bg-primary-soft text-primary-soft-foreground", ring: "ring-primary/15" },
};

/**
 * "Do now" (UX-040): up to three prioritised, data-driven nudges — each one fact and one action
 * that lands on the exact filtered page. Most urgent first; a calm green line when all is fine.
 */
export function GuideStrip({ title, items }: { title: string; items: GuideItem[] }) {
  return (
    <section aria-label={title} className="grid gap-3 @3xl/main:grid-cols-3">
      {items.map((item, index) => {
        const Icon = ICON[item.icon];
        const tone = TONE[item.tone];
        const body = (
          <>
            <span
              className={cn(
                "inline-flex size-9 shrink-0 items-center justify-center rounded-xl",
                tone.tile,
              )}
            >
              <Icon className="size-[1.1rem]" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm leading-snug font-semibold">{item.text}</span>
              {item.cta && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-link">
                  {item.cta}
                  <ArrowRight
                    aria-hidden
                    className="size-3.5 transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              )}
            </span>
          </>
        );
        const className = cn(
          "glass group flex animate-rise items-center gap-3 rounded-[1.25rem] p-3 ring-1 transition-[transform,box-shadow] duration-(--dur-2)",
          tone.ring,
          item.href && "hover:-translate-y-0.5 hover:ring-primary/30 active:scale-[0.99]",
        );
        return item.href ? (
          <Link
            key={item.key}
            href={item.href}
            className={className}
            style={{ animationDelay: `${index * 60}ms` }}
          >
            {body}
          </Link>
        ) : (
          <div key={item.key} className={className} style={{ animationDelay: `${index * 60}ms` }}>
            {body}
          </div>
        );
      })}
    </section>
  );
}
