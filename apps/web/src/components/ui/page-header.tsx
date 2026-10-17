import { CountUp } from "@/components/motion/count-up";
import { LookAtPointer } from "@/components/motion/look-at-pointer";
import { ProfileBuddy, type BuddyMood } from "@/components/profile/profile-buddy";
import { cn } from "@/lib/utils";

export interface PageHeaderStat {
  label: React.ReactNode;
  value: React.ReactNode;
  /** "now": needs attention (a pulsing yellow marker); "muted": done or quiet. */
  tone?: "primary" | "now" | "muted";
}

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Small label above the title (e.g. the area or a count). */
  eyebrow?: React.ReactNode;
  /** The page at a glance: a dot, a number and a word each (read, not pressed). */
  stats?: PageHeaderStat[];
  /** The companion acting out where the page stands, with a short bubble. */
  mood?: BuddyMood;
  bubble?: React.ReactNode;
  /** Red-tinted surface when something is overdue or failing. */
  tone?: "danger";
  className?: string;
}

const DOT: Record<NonNullable<PageHeaderStat["tone"]>, string> = {
  primary: "bg-primary",
  now: "missing-mark bg-sun",
  muted: "bg-foreground/20 dark:bg-white/25",
};

/**
 * Every portal and back-office page opens the same way (UX-028/032): the applicant pages' hero
 * surface — an eyebrow, the title, one line, the page in a few numbers and its actions — with the
 * companion on the right, looking at the pointer. Flat: a soft wash and a hairline, no shadow.
 */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  stats,
  mood,
  bubble,
  tone,
  className,
}: PageHeaderProps) {
  return (
    <header
      data-spot
      data-tone={tone}
      className={cn(
        "hero-surface relative flex animate-rise items-center gap-4 overflow-hidden rounded-[1.75rem] p-5 sm:p-7",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-col gap-1">
          {eyebrow && (
            <span
              className={cn(
                "text-[0.7rem] font-bold tracking-widest uppercase",
                tone === "danger" ? "text-destructive" : "text-link",
              )}
            >
              {eyebrow}
            </span>
          )}
          <h1 className="text-2xl leading-tight font-bold tracking-tight text-balance @3xl/main:text-3xl">
            {title}
          </h1>
          {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
        </div>
        {stats && stats.length > 0 && (
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
            {stats.map((stat, i) => (
              <li key={i} className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className={cn("size-2 shrink-0 rounded-full", DOT[stat.tone ?? "primary"])}
                />
                <span className="font-bold num text-foreground">
                  {/* Numbers count up once (UX-033); anything else is shown as is. */}
                  {typeof stat.value === "number" ? <CountUp value={stat.value} /> : stat.value}
                </span>
                {stat.label}
              </li>
            ))}
          </ul>
        )}
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {mood && (
        <div className="relative -my-2 -mr-2 hidden shrink-0 @lg/main:block">
          {bubble && (
            <span
              aria-hidden
              className={cn(
                "absolute top-4 right-[70%] z-10 hidden rounded-2xl rounded-br-sm px-3 py-1.5 text-xs font-semibold whitespace-nowrap @3xl/main:block",
                tone === "danger"
                  ? "bg-destructive text-white"
                  : "bg-primary-soft text-primary-soft-foreground",
              )}
            >
              {bubble}
            </span>
          )}
          <LookAtPointer>
            <ProfileBuddy mood={mood} className="h-28 w-auto @3xl/main:h-32" />
          </LookAtPointer>
        </div>
      )}
    </header>
  );
}
