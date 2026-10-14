import { Skeleton } from "@/components/ui/skeleton";

/**
 * Auth form skeletons, shaped like each page so nothing jumps when it arrives: optional icon
 * tile, title + Sun underline + line, optional Google button and "or", fields, the pill button.
 */
export function AuthSkeleton({
  icon = false,
  google = false,
  fields = 2,
  segmented = false,
  pairs = false,
  code = false,
}: {
  icon?: boolean;
  google?: boolean;
  fields?: number;
  /** Sign-up's account type switch. */
  segmented?: boolean;
  /** Sign-up's side-by-side passwords. */
  pairs?: boolean;
  /** A 6-box code input (verification, two-step). */
  code?: boolean;
}) {
  return (
    <div className="flex flex-col gap-6" aria-busy data-route-loading>
      <div className="flex flex-col gap-3">
        {icon && <Skeleton className="mb-1 size-14 rounded-2xl" />}
        <Skeleton className="h-9 w-2/3 rounded-xl" />
        <Skeleton className="h-2 w-24 rounded-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      {google && (
        <>
          <Skeleton className="h-12 rounded-full" />
          <Skeleton className="mx-auto h-4 w-10 rounded-full" />
        </>
      )}
      {segmented && <Skeleton className="h-16 rounded-2xl" />}
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-12" />
        </div>
      ))}
      {pairs && (
        <div className="grid gap-5 sm:grid-cols-2 sm:gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-12" />
            </div>
          ))}
        </div>
      )}
      {code && (
        <div className="flex justify-between gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 flex-1 rounded-xl" />
          ))}
        </div>
      )}
      <Skeleton className="h-12 rounded-full" />
      <Skeleton className="h-11 rounded-2xl opacity-70" />
    </div>
  );
}
