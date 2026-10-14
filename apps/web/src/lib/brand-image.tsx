/**
 * Brand mark for generated images (navy #010080, ADR-009 v2) (icons, Open Graph). Plain JSX for next/og (Satori), so only
 * inline styles and simple SVG. Colours are the ADR-009 tokens in hex.
 */
export const BRAND = {
  navy: "#010080",
  royal: "#1d3fd6",
  ink: "#0c0f13",
  sun: "#fad03e",
  paper: "#f8fbf9",
};

export function BrandMark({ size, padding = 0 }: { size: number; padding?: number }) {
  const inner = size - padding * 2;
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: padding ? BRAND.navy : "transparent",
      }}
    >
      <svg width={inner} height={inner} viewBox="0 0 32 32">
        <rect width="32" height="32" rx={padding ? 0 : 10} fill={BRAND.navy} />
        <path d="M8 15.5 16 9l8 6.5V24a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z" fill="#f9fdfb" />
        <path
          d="m12.5 18.5 2.5 2.5 4.5-5"
          fill="none"
          stroke={BRAND.navy}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="25" cy="8" r="3" fill={BRAND.sun} />
      </svg>
    </div>
  );
}
