import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import type { Icon, IconProps } from "./fluent-icon";

/**
 * A side-navigation icon from Lucide (https://lucide.dev, ISC): simple open shapes with round caps
 * and joins on a 24 px grid, drawn as a plain SVG (no hooks: it renders in Server Components). The
 * rest of the app uses Fluent (fluent-icon.tsx); both share `IconProps`, so nav config can mix them.
 *
 * The line weight comes from the `--icon-stroke` token (shell.css: 1.25 in the sidebar), which
 * overrides the glyph's drawn width; `strokeWidth` sets it for one icon. `filled` is accepted and
 * draws the outline (ADR-009 amendment v8).
 */
/** `body` is build-time SVG from scripts/gen-nav-icons.mjs, sanitised to drawing elements only. */
export function svgIcon(name: string, body: string): Icon {
  function SvgIcon({
    size = 24,
    filled: _filled,
    strokeWidth,
    absoluteStrokeWidth: _absolute,
    className,
    style,
    ...rest
  }: IconProps) {
    const labelled = rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined;
    const stroke =
      strokeWidth === undefined
        ? style
        : ({ ...style, "--icon-stroke": strokeWidth } as CSSProperties);
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        focusable="false"
        aria-hidden={labelled ? undefined : true}
        role={labelled ? "img" : undefined}
        data-icon={name}
        className={cn("shrink-0", className)}
        style={stroke}
        {...rest}
        dangerouslySetInnerHTML={{ __html: body }}
      />
    );
  }
  SvgIcon.displayName = `Icon(${name})`;
  return SvgIcon;
}
