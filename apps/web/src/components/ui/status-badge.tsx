import type { StatusTone } from "@rebp/contracts";
import { TONE_ICONS, TONE_SOFT_BG, TONE_TEXT } from "@/components/data/tones";
import { cn } from "@/lib/utils";

/**
 * Status chip: tone colour + tone icon + label, always together (WCAG 1.4.1).
 * Pass the tone from the contracts maps, e.g. `LICENSE_STATUS_TONES[status]`.
 */
export function StatusBadge({
  tone,
  label,
  size = "sm",
  className,
}: {
  tone: StatusTone;
  label: React.ReactNode;
  size?: "sm" | "lg";
  className?: string;
}) {
  const Icon = TONE_ICONS[tone];
  return (
    <span
      data-slot="badge"
      data-tone={tone}
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full font-semibold whitespace-nowrap",
        size === "sm"
          ? "px-2.5 py-0.5 text-xs [&_svg]:size-3.5"
          : "px-3.5 py-1.5 text-sm [&_svg]:size-4",
        TONE_SOFT_BG[tone],
        TONE_TEXT[tone],
        className,
      )}
    >
      <Icon aria-hidden />
      {label}
    </span>
  );
}
