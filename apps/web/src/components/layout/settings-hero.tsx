import { LookAtPointer } from "@/components/motion/look-at-pointer";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * The account pages' shared header (UX-013): Profile, Security and My access open the same way —
 * the photo in its completion ring, the page's title and one line of status, and on the right a
 * companion acting out where this page stands. Only the title, status and companion change.
 */
export function SettingsHero({
  avatar,
  title,
  description,
  meta,
  companion,
}: {
  avatar: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** A small line under the status (e.g. the save state). */
  meta?: React.ReactNode;
  companion?: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby="settings-title"
      className="hero-surface relative flex items-center gap-4 overflow-hidden rounded-[1.75rem] py-4 pr-2 pl-4 sm:gap-5 sm:pl-6"
    >
      {avatar}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h1
          id="settings-title"
          className="text-lg leading-tight font-bold tracking-tight text-balance @3xl/main:text-2xl"
        >
          {title}
        </h1>
        {/* On phones the ring and the page itself say this; the hero stays one short row. */}
        {description && (
          <p className="text-sm text-muted-foreground @max-md/main:hidden">{description}</p>
        )}
        {meta}
      </div>
      {companion}
    </section>
  );
}

/**
 * The companion on the right of the hero, with a short speech bubble. It is the way to what's
 * left to do: a link (`href`) on server-rendered pages, or a button (`onClick`) on the profile.
 */
export function HeroCompanion({
  bubble,
  label,
  tone = "default",
  href,
  onClick,
  children,
}: {
  bubble: string;
  /** Accessible name: the bubble and where it leads. */
  label: string;
  tone?: "default" | "danger";
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const className =
    "group/buddy relative -mb-4 shrink-0 self-end rounded-2xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40";
  const content = (
    <>
      <span
        key={bubble}
        aria-hidden
        className={cn(
          "absolute top-5 right-[72%] z-10 hidden animate-pop rounded-2xl rounded-br-sm px-3 py-1.5 text-xs font-semibold whitespace-nowrap @2xl/main:block",
          tone === "danger"
            ? "bg-destructive text-white"
            : "bg-primary-soft text-primary-soft-foreground",
        )}
      >
        {bubble}
      </span>
      {/* The companion looks at the pointer (UX-031). */}
      <LookAtPointer className="transition-transform duration-(--dur-3) ease-(--ease-spring) group-hover/buddy:-translate-y-1 [&>svg]:h-24 [&>svg]:w-auto @md/main:[&>svg]:h-36 @3xl/main:[&>svg]:h-40">
        {children}
      </LookAtPointer>
    </>
  );
  return href ? (
    <a href={href} aria-label={label} className={className}>
      {content}
    </a>
  ) : (
    <button type="button" onClick={onClick} aria-label={label} className={className}>
      {content}
    </button>
  );
}

/** The hero's loading state, for the account pages' `loading.tsx` (with the tabs under it). */
export function SettingsHeroSkeleton() {
  return (
    <>
      <div className="flex items-center gap-4 rounded-[1.75rem] bg-card/60 p-4 sm:gap-5 sm:px-6 dark:bg-surface-2/70">
        <Skeleton className="size-20 shrink-0 rounded-full @md/main:size-24 @3xl/main:size-28" />
        <div className="flex flex-1 flex-col gap-2.5">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 max-w-full @max-md/main:hidden" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="size-24 shrink-0 rounded-full @md/main:size-32" />
      </div>
      <Skeleton className="h-12 rounded-full" />
    </>
  );
}
