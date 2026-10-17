import { Skeleton } from "@/components/ui/skeleton";

/** The ComingSoon page's shape: art, title, line, action and chip. */
export function ComingSoonSkeleton() {
  return (
    <div
      className="flex flex-col items-center gap-5 rounded-[2rem] bg-card/60 px-6 py-12 dark:bg-white/[0.03]"
      aria-busy
      data-route-loading
    >
      <Skeleton className="size-48 rounded-full opacity-70" />
      <Skeleton className="h-8 w-64 rounded-xl" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <Skeleton className="h-11 w-44 rounded-full" />
      <Skeleton className="h-6 w-28 rounded-full" />
    </div>
  );
}
