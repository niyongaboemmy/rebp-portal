import { parallaxStyle } from "@/components/motion/parallax";

/** Ellipse perimeter (Ramanujan), so a comet's dash and travel use real lengths. */
const perimeter = (a: number, b: number) =>
  Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));

/** Two tilted orbits around the licence; each carries one comet of light. */
const ORBITS = [
  { rx: 198, ry: 52, tilt: -8, comet: "stroke-link text-link", duration: "9s", reverse: false },
  { rx: 186, ry: 40, tilt: 9, comet: "stroke-sun text-sun", duration: "13s", reverse: true },
] as const;

/**
 * Hero stage (landing, right column): the space the licence floats in. Everything is abstract
 * so the card stays the subject:
 * - aurora: three slow, blurred light pools in the brand blues with a touch of Sun
 * - floor: a perspective grid that flows towards the viewer, fading into the page
 * - orbits: two hairline ellipses with comets travelling round the card
 * - pulse: a verification ripple every few seconds (FR-N-002: licences are verifiable)
 * CSS-only (no JS, no images); each layer moves a little with the pointer (HeroScene).
 * Reduced motion keeps the composition still; low-data mode hides it.
 */
export function HeroStage() {
  return (
    <div aria-hidden className="hero-stage pointer-events-none absolute inset-0 -z-10">
      <div className="absolute -inset-[30%]" style={parallaxStyle(6)}>
        <span className="absolute top-[18%] left-[22%] size-[46%] animate-aurora rounded-full bg-primary/25 blur-3xl dark:bg-primary/35" />
        <span className="absolute top-[30%] right-[14%] size-[38%] animate-aurora rounded-full bg-sky/25 blur-3xl [animation-delay:-6s] [animation-duration:22s] dark:bg-sky/20" />
        <span className="absolute bottom-[20%] left-[38%] size-[22%] animate-aurora rounded-full bg-sun/20 blur-3xl [animation-delay:-11s] [animation-duration:26s] dark:bg-sun/12" />
      </div>

      <div
        className="absolute top-[60%] left-1/2 h-[90%] w-[170%] animate-grid-flow [--grid-line:oklch(0.52_0.23_264/0.24)] dark:[--grid-line:oklch(0.78_0.12_266/0.22)]"
        style={{
          transform: "translateX(-50%) perspective(640px) rotateX(70deg)",
          transformOrigin: "50% 0",
          backgroundImage:
            "linear-gradient(to right, var(--grid-line) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(ellipse 50% 90% at 50% 0%, #000 35%, transparent 80%), linear-gradient(to bottom, transparent, #000 30%)",
          maskComposite: "intersect",
        }}
      />

      <div className="absolute top-1/2 left-1/2 aspect-square w-[140%] -translate-x-1/2 -translate-y-1/2">
        {[0, 1].map((i) => (
          <span
            key={i}
            className="absolute inset-[24%] animate-verify-pulse rounded-full bg-[radial-gradient(closest-side,transparent_calc(100%-2px),oklch(0.62_0.18_262/0.45)_calc(100%-1px),transparent_100%)]"
            style={{ animationDelay: `${i * 2.4}s` }}
          />
        ))}
      </div>

      <svg
        viewBox="0 0 400 400"
        className="absolute top-1/2 left-1/2 w-[165%] -translate-x-1/2 -translate-y-1/2 overflow-visible"
        style={parallaxStyle(-6)}
      >
        {ORBITS.map((orbit) => (
          <g key={orbit.rx} transform={`rotate(${orbit.tilt} 200 200)`}>
            <ellipse
              cx="200"
              cy="200"
              rx={orbit.rx}
              ry={orbit.ry}
              fill="none"
              strokeWidth="1"
              className="stroke-foreground/10 dark:stroke-white/10"
            />
            <ellipse
              cx="200"
              cy="200"
              rx={orbit.rx}
              ry={orbit.ry}
              fill="none"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={`56 ${perimeter(orbit.rx, orbit.ry) - 56}`}
              className={`${orbit.comet} animate-orbit drop-shadow-[0_0_6px_currentColor]`}
              style={{
                ["--orbit-length" as string]: `${perimeter(orbit.rx, orbit.ry)}px`,
                animationDuration: orbit.duration,
                animationDirection: orbit.reverse ? "reverse" : "normal",
              }}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
