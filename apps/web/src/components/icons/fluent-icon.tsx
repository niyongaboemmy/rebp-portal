import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/utils";

/**
 * An icon from Microsoft's Fluent UI System Icons, drawn as a plain SVG (no hooks: it renders in
 * Server Components). Props match what the app passed to lucide icons, so call sites didn't
 * change: `className` (size with `size-5`…), `size` (default 24 px), `strokeWidth` (ignored:
 * Fluent glyphs are filled shapes). `filled` switches to the Filled variant — Microsoft's way of
 * marking the active item (nav, toggles).
 */
export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "ref"> {
  size?: number | string;
  /** Accepted for compatibility; Fluent icons have no stroke. */
  strokeWidth?: number | string;
  absoluteStrokeWidth?: boolean;
  /** The Filled variant (active / selected state). */
  filled?: boolean;
}

export type Icon = ComponentType<IconProps>;
/** Kept so `type LucideIcon` imports keep compiling. */
export type LucideIcon = Icon;

export function fluentIcon(
  name: string,
  regular: string[],
  filled: string[],
  flipInRtl = false,
): Icon {
  function FluentIcon({
    size = 24,
    filled: useFilled = false,
    strokeWidth: _strokeWidth,
    absoluteStrokeWidth: _absolute,
    className,
    ...rest
  }: IconProps) {
    const labelled = rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined;
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        width={size}
        height={size}
        fill="currentColor"
        focusable="false"
        aria-hidden={labelled ? undefined : true}
        role={labelled ? "img" : undefined}
        data-icon={name}
        className={cn("shrink-0", flipInRtl && "rtl:-scale-x-100", className)}
        {...rest}
      >
        {(useFilled ? filled : regular).map((d, i) => (
          <path key={i} d={d} />
        ))}
      </svg>
    );
  }
  FluentIcon.displayName = `Icon(${name})`;
  return FluentIcon;
}
