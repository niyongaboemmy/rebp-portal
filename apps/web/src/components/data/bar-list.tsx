import { cn } from "@/lib/utils";

export interface BarListItem {
  key: string;
  label: string;
  value: number;
  icon?: React.ReactNode;
}

/**
 * Ranked horizontal bars with the label inside the track and the value outside — dense and
 * legible on phones (users by role, register by district). Single hue: magnitude, not identity.
 */
export function BarList({
  items,
  label,
  className,
}: {
  items: BarListItem[];
  label: string;
  className?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul aria-label={label} className={cn("flex flex-col gap-1.5", className)}>
      {items.map((item, index) => (
        <li key={item.key} className="flex items-center gap-3">
          <div className="relative flex h-9 min-w-0 flex-1 items-center overflow-hidden rounded-lg">
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 origin-left animate-[meter-in_var(--dur-5)_var(--ease-enter)_both] rounded-lg bg-primary-soft"
              style={{
                width: `${Math.max(2, (item.value / max) * 100)}%`,
                animationDelay: `${index * 40}ms`,
              }}
            />
            <span className="relative flex min-w-0 items-center gap-2 px-3 text-sm font-medium [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-link">
              {item.icon}
              <span className="truncate">{item.label}</span>
            </span>
          </div>
          <span className="min-w-10 text-right text-sm font-semibold num">
            {item.value.toLocaleString("en-US")}
          </span>
        </li>
      ))}
    </ul>
  );
}
