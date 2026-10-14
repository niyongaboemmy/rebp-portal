import { cn, initials } from "@/lib/utils";

/** Initials avatar; colour derived from the name so each person is recognisable. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const hue = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 360;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold",
        className,
      )}
      style={{ background: `oklch(0.9 0.06 ${hue})`, color: `oklch(0.35 0.09 ${hue})` }}
    >
      {initials(name)}
    </span>
  );
}
