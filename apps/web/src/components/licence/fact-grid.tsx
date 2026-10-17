import { cn } from "@/lib/utils";

export interface Fact {
  key: string;
  label: React.ReactNode;
  value: React.ReactNode;
  /** Numbers and codes in the mono face. */
  mono?: boolean;
  /** Spans both columns from `sm` (long values: scope, conditions). */
  wide?: boolean;
}

/** Label/value pairs for licence details: one column on phones, two from `sm`. */
export function FactGrid({ facts, className }: { facts: Fact[]; className?: string }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-4 sm:grid-cols-2", className)}>
      {facts.map((fact) => (
        <div
          key={fact.key}
          className={cn("flex min-w-0 flex-col gap-0.5", fact.wide && "sm:col-span-2")}
        >
          <dt className="text-xs font-medium text-muted-foreground">{fact.label}</dt>
          <dd className={cn("text-sm font-semibold break-words", fact.mono && "font-mono num")}>
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
