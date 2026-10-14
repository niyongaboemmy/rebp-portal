import { Skeleton, SkeletonHero } from "@/components/ui/skeleton";

/** Categories: hero, the career map (eight stations on a route) and the FAQ rows. */
export default function CategoriesLoading() {
  return (
    <div className="flex flex-col" aria-busy data-route-loading>
      <SkeletonHero />
      <div className="container-page flex flex-col gap-16 pb-20">
        <div className="relative aspect-[360/760] w-full rounded-[2rem] bg-surface-2 lg:aspect-[1000/430] dark:bg-white/[0.025]">
          {[
            [8, 80],
            [21, 63],
            [39, 51],
            [57, 42],
            [74, 77],
            [76, 48],
            [77, 19],
            [92, 19],
          ].map(([x, y], i) => (
            <Skeleton
              key={i}
              className="absolute size-12 -translate-x-1/2 -translate-y-1/2 rounded-2xl max-lg:hidden lg:size-16"
              style={{ left: `${x}%`, top: `${y}%` }}
            />
          ))}
          {[9, 17, 33, 52, 72, 76, 72, 93].map((y, i) => (
            <Skeleton
              key={`m${i}`}
              className="absolute size-12 -translate-x-1/2 -translate-y-1/2 rounded-2xl lg:hidden"
              style={{ left: `${[25, 75, 50, 50, 17, 50, 83, 83][i]}%`, top: `${y}%` }}
            />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
