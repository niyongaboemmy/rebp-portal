import type { MetadataRoute } from "next";

/** UX-015: installable PWA. Colours match the light theme tokens (ADR-009). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "REBP Portal",
    short_name: "REBP",
    description: "Register, get licensed and verify Real Estate Brokerage Practitioners and Firms.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fbf9",
    theme_color: "#006d45",
    categories: ["government", "business", "productivity"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Verify a licence", url: "/check" },
      { name: "Am I eligible?", url: "/eligibility" },
    ],
  };
}
