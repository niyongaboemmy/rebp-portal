import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Loading shapes for the application flow (UX-009). Each mirrors the real layout — the same
 * cards, columns and heights — so nothing jumps when the content arrives, and the shimmer reads
 * as "working". Screen readers hear one "Loading…".
 */

const CARD = "glass rounded-[1.75rem] ring-1 ring-primary/[0.08] dark:ring-white/[0.06]";

async function Busy({ children, className }: { children: React.ReactNode; className?: string }) {
  const t = await getTranslations("common");
  return (
    <div role="status" aria-busy data-route-loading className={className}>
      <span className="sr-only">{t("loading")}</span>
      {children}
    </div>
  );
}

/** A field: label above a control. */
function FieldShape({ wide = false }: { wide?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className={cn("h-4", wide ? "w-48" : "w-32")} />
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  );
}

/** The wizard: one-line header, stage strip, the rail and the form card. */
export async function WizardSkeleton() {
  return (
    <Busy className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline gap-3">
        <Skeleton className="h-7 w-72 max-w-full rounded-xl" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-24 rounded-full" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-1 items-center gap-3">
            <Skeleton className="h-px flex-1" />
            <Skeleton className="size-8 rounded-full" />
          </div>
        ))}
      </div>
      <div className="grid items-start gap-5 @4xl/main:grid-cols-[16rem_minmax(0,1fr)]">
        {/* Rail (desktop). */}
        <div className={cn("hidden flex-col gap-4 p-4 @4xl/main:flex", CARD, "rounded-[1.5rem]")}>
          <div className="flex items-end justify-between">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-7 w-12 rounded-lg" />
          </div>
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-1.5 flex-1 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-5 w-full rounded-full" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 py-1">
              <Skeleton className="size-8 rounded-xl" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-3 w-6" />
            </div>
          ))}
        </div>
        {/* Form card. */}
        <div className={cn("flex flex-col gap-6 p-5 sm:p-8", CARD)}>
          <div className="flex items-center justify-between">
            <Skeleton className="h-7 w-56 rounded-xl" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-1.5">
              <Skeleton className="h-8 w-40 rounded-full" />
              <Skeleton className="h-8 w-28 rounded-full" />
              <Skeleton className="h-8 w-28 rounded-full" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-5 w-48" />
          <div className="grid gap-2.5 @xl/main:grid-cols-2">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
          <div className="grid gap-4 @xl/main:grid-cols-2">
            <FieldShape wide />
            <FieldShape />
          </div>
          <div className="mt-2 flex items-center justify-between rounded-full bg-foreground/[0.03] p-1.5 dark:bg-surface-2/70">
            <Skeleton className="h-10 w-24 rounded-full" />
            <Skeleton className="h-10 w-32 rounded-full" />
          </div>
        </div>
      </div>
    </Busy>
  );
}

/** "Start an application": header, survey progress, the question and its cards. */
export async function SurveySkeleton() {
  return (
    <Busy className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-10 w-80 max-w-full rounded-xl" />
      </div>
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-1.5 w-8 rounded-full" />
        <Skeleton className="h-1.5 w-4 rounded-full" />
        <Skeleton className="h-1.5 w-4 rounded-full" />
      </div>
      <Skeleton className="h-6 w-60 rounded-lg" />
      <div className="grid gap-3 sm:grid-cols-2 @5xl/main:grid-cols-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-2xl bg-card p-4 shadow-[0_1px_2px_oklch(0.3_0.06_264/0.05)] dark:bg-surface-2/70"
          >
            <Skeleton className="size-10 rounded-xl" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-full bg-foreground/[0.03] p-1.5 dark:bg-surface-2/70">
        <span />
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>
    </Busy>
  );
}

/** An application's page: the status hero and its sections. */
export async function ApplicationSkeleton() {
  return (
    <Busy className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-9 w-72 max-w-full rounded-xl" />
      </div>
      <div className={cn("flex flex-col gap-4 p-6", CARD)}>
        <Skeleton className="h-6 w-48 rounded-lg" />
        <div className="flex gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-2 flex-1 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-11 w-48 rounded-full" />
      </div>
      <div className="grid gap-5 @3xl/main:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className={cn("flex flex-col gap-3 p-5", CARD)}>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </Busy>
  );
}
