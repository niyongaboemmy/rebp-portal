/**
 * Inline style for a parallax layer inside <HeroScene>: deeper layers move further (px per unit
 * of pointer offset). Shared by server and client components.
 */
export function parallaxStyle(depth: number): React.CSSProperties {
  return {
    transform: `translate3d(calc(var(--px) * ${depth}px), calc(var(--py) * ${depth}px), 0)`,
    transition: "transform 400ms cubic-bezier(0.2, 0, 0, 1)",
  };
}
