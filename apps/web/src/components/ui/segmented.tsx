"use client";

import { ToggleGroup } from "radix-ui";
import { cn } from "@/lib/utils";

interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

/**
 * iOS-style segmented control (single choice). The thumb slides between options with a
 * transform-only animation; Radix provides roving focus and arrow-key navigation.
 */
export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
  size = "default",
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: SegmentedOption<T>[];
  label: string;
  className?: string;
  size?: "default" | "sm";
}) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => next && onValueChange(next as T)}
      aria-label={label}
      className={cn(
        "relative grid w-full auto-cols-fr grid-flow-col rounded-2xl bg-muted p-1",
        className,
      )}
      style={{ "--count": options.length, "--index": index } as React.CSSProperties}
    >
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/var(--count))] translate-x-[calc(100%*var(--index))] rounded-xl bg-card shadow-soft transition-transform duration-(--dur-3) ease-spring"
      />
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          className={cn(
            "relative z-10 inline-flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-3 font-semibold text-muted-foreground transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 data-[state=on]:text-foreground [&_svg]:size-4 [&_svg]:shrink-0",
            size === "sm" ? "h-9 text-xs" : "tap-target text-sm",
          )}
        >
          {option.icon}
          <span className="truncate">{option.label}</span>
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
