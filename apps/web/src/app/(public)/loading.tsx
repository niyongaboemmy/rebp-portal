import { Skeleton } from "@/components/ui/skeleton";

/** Home: the hero's two columns (copy and buttons; the card stack) in skeleton form. */
export default function HomeLoading() {
  return (
    <div
      className="relative isolate -mt-16 flex min-h-svh items-center pt-16"
      aria-busy
      data-route-loading
    >
      <div aria-hidden className="absolute inset-0 -z-10 bg-ambient" />
      <div className="container-page grid w-full gap-10 lg:grid-cols-[1.25fr_1fr] lg:items-center lg:gap-14">
        <div className="relative mx-auto aspect-[1.4] w-full max-w-md max-lg:order-first lg:max-w-full">
          {[
            "-rotate-12 -translate-x-[8%] -translate-y-[12%] scale-90",
            "-rotate-6 -translate-y-[6%] scale-95",
            "",
          ].map((pose, i) => (
            <Skeleton
              key={i}
              className={`absolute inset-[12%] rounded-[1.75rem] ${pose}`}
              style={{ opacity: 0.5 + i * 0.25 }}
            />
          ))}
          <Skeleton className="absolute right-0 bottom-[6%] h-14 w-52 rounded-2xl" />
        </div>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-6 w-44 rounded-full" />
          <Skeleton className="h-14 w-full max-w-xl rounded-2xl" />
          <Skeleton className="h-14 w-3/4 max-w-md rounded-2xl" />
          <Skeleton className="h-5 w-2/3 max-w-sm" />
          <div className="flex flex-wrap gap-3 pt-3">
            <Skeleton className="h-12 w-40 rounded-full" />
            <Skeleton className="h-12 w-56 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-10 w-72 rounded-full" />
        </div>
      </div>
    </div>
  );
}
