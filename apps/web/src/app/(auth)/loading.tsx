import { Skeleton } from "@/components/ui/skeleton";

/** An auth form streaming in, inside the layout's glass card: title, line, fields, button. */
export default function AuthLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy data-route-loading>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-2/3 rounded-xl" />
        <Skeleton className="h-2 w-24 rounded-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <Skeleton className="h-12 rounded-full" />
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-12" />
        </div>
      ))}
      <Skeleton className="h-12 rounded-full" />
    </div>
  );
}
