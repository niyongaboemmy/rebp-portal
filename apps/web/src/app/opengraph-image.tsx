import { ImageResponse } from "next/og";
import { BRAND, BrandMark } from "@/lib/brand-image";

export const alt = "REBP Portal — real estate brokerage licensing and public register";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Default social card: brand mark, product name and the three public promises. */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: `radial-gradient(circle at 90% 0%, ${BRAND.royal} 0%, transparent 55%), radial-gradient(circle at 0% 100%, #2a0a6b 0%, transparent 55%), ${BRAND.navy}`,
        color: "#f1f4f6",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <BrandMark size={96} />
        <span style={{ fontSize: 44, fontWeight: 700 }}>REBP Portal</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <span style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
          Apply. Track. Verify.
        </span>
        <span style={{ fontSize: 32, color: "#9ea6ae" }}>
          Real estate brokerage licensing and the public register
        </span>
      </div>
      <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden" }}>
        <div style={{ flex: 3, background: "#ffffff" }} />
        <div style={{ flex: 1, background: "#0068ad" }} />
        <div style={{ flex: 1, background: BRAND.sun }} />
      </div>
    </div>,
    size,
  );
}
