import { DISTRICT_CENTRES } from "@/config/districts-geo";
import { RWANDA_PROVINCES, RWANDA_VIEW, projectRwanda } from "@/config/rwanda-shape";
import { Skeleton } from "@/components/ui/skeleton";

/** A few district seats that pulse while the map loads (decorative). */
const PINGS = ["Gasabo", "Musanze", "Huye", "Rubavu", "Nyagatare", "Rusizi"] as const;

/**
 * Directory loading state, the same size and layout as the page it becomes: it fills the screen
 * under the header (no scroll), Rwanda's outline draws itself in the middle with districts
 * pulsing, a brand light band sweeps across, and the floating panel, map tools and bottom bar
 * sit where they will appear. Used by the route's loading.tsx and while the map engine loads.
 */
export function RegisterSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-busy
      aria-label={label}
      data-route-loading
      data-fullscreen-map
      data-loop
      className="relative isolate flex-1 overflow-hidden bg-surface-2 dark:bg-[oklch(0.16_0.015_265)]"
    >
      {/* Map paper: a faint grid, the outline of Rwanda drawing in, districts pinging. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(var(--color-foreground)_1px,transparent_1px),linear-gradient(90deg,var(--color-foreground)_1px,transparent_1px)] [background-size:56px_56px] opacity-[0.035]"
      />
      <div
        aria-hidden
        className="absolute top-1/2 left-1/2 -z-10 w-[min(44rem,88vw)] -translate-x-1/2 -translate-y-1/2 lg:left-[62%]"
        style={{ aspectRatio: `${RWANDA_VIEW.width} / ${RWANDA_VIEW.height}` }}
      >
        <svg
          viewBox={`0 0 ${RWANDA_VIEW.width} ${RWANDA_VIEW.height}`}
          className="absolute inset-0 size-full overflow-visible"
        >
          {RWANDA_PROVINCES.map((p, i) => (
            <path
              key={p.key}
              d={p.d}
              pathLength={1}
              className="fill-primary/[0.05] stroke-primary/40 dark:fill-white/[0.03] dark:stroke-white/25"
              strokeWidth="0.35"
              strokeDasharray="1"
              style={{ animation: `skeleton-draw 1.6s var(--ease-enter) ${i * 140}ms both` }}
            />
          ))}
        </svg>
        {PINGS.map((name, i) => {
          const centre = DISTRICT_CENTRES[name];
          if (!centre) return null;
          const { x, y } = projectRwanda(centre);
          return (
            <span
              key={name}
              className="absolute size-3 -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${(x / RWANDA_VIEW.width) * 100}%`,
                top: `${(y / RWANDA_VIEW.height) * 100}%`,
              }}
            >
              <span
                className="absolute inset-0 animate-ping rounded-full bg-primary/50 [animation-duration:1.8s]"
                style={{ animationDelay: `${600 + i * 260}ms` }}
              />
              <span className="absolute inset-0.5 rounded-full bg-primary/70" />
            </span>
          );
        })}
      </div>
      {/* Brand light band sweeping across the whole page. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 -translate-x-full animate-skeleton-sweep bg-[linear-gradient(100deg,transparent_30%,color-mix(in_oklch,var(--primary)_7%,transparent),color-mix(in_oklch,var(--sky)_8%,transparent),color-mix(in_oklch,var(--sun)_7%,transparent),transparent_70%)] [animation-duration:2.4s]"
      />

      {/* Floating chrome, where it will be. */}
      <div className="absolute inset-0">
        <div className="relative container-page h-full">
          <div className="absolute top-3 right-3 left-3 flex flex-col gap-4 rounded-3xl bg-card/85 p-4 shadow-[0_8px_28px_-14px_oklch(0.3_0.12_264/0.45)] backdrop-blur-xl sm:top-4 sm:right-auto sm:left-6 sm:w-[25rem] sm:p-5 lg:left-8 dark:bg-[oklch(0.19_0.02_265/0.85)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-7 w-32 rounded-xl" />
                <Skeleton className="h-1.5 w-20 rounded-full bg-sun/40" />
              </div>
              <Skeleton className="h-10 w-36 rounded-full" />
            </div>
            <div className="rounded-full bg-[conic-gradient(from_0deg,var(--primary),var(--sky),var(--sun),var(--primary))] p-[1.5px] opacity-70">
              <Skeleton className="h-11 rounded-full bg-card dark:bg-[oklch(0.2_0.02_265)]" />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 rounded-2xl" />
              ))}
            </div>
          </div>
          <div className="absolute top-4 right-6 hidden flex-col gap-1 rounded-full bg-card/85 p-1 backdrop-blur-xl sm:flex lg:right-8 dark:bg-[oklch(0.19_0.02_265/0.85)]">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="size-10 rounded-full" />
            ))}
          </div>
          <div className="absolute right-3 bottom-3 left-3 flex items-center gap-2 rounded-full bg-card/85 p-1 backdrop-blur-xl sm:right-auto sm:bottom-4 sm:left-6 lg:left-8 dark:bg-[oklch(0.19_0.02_265/0.85)]">
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-9 w-44 rounded-full" />
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="hidden h-4 w-36 rounded-full sm:block" />
          </div>
        </div>
      </div>
    </div>
  );
}
