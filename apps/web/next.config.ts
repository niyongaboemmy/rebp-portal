import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const isDev = process.env.NODE_ENV !== "production";

// SEC-002. Inline scripts are needed by Next.js hydration; a nonce-based CSP is tracked for R2.
const csp = [
  "default-src 'self'",
  // Google Identity Services: the sign-in button's script, styles, iframe and FedCM calls (ADR-004).
  `script-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/client${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  // Register map tiles (OpenFreeMap streets, EOX Sentinel-2 cloudless 2016 satellite).
  "img-src 'self' data: blob: https://lh3.googleusercontent.com https://tiles.openfreemap.org https://tiles.maps.eox.at",
  "font-src 'self' data:",
  `connect-src 'self' https://tiles.openfreemap.org https://tiles.maps.eox.at https://accounts.google.com/gsi/${isDev ? " ws:" : ""}`,
  "frame-src 'self' https://accounts.google.com/gsi/",
  // MapLibre renders in a blob: web worker.
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "form-action 'self' https://accounts.google.com",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(self), payment=()",
  },
  ...(isDev
    ? []
    : [
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      ]),
];

const nextConfig: NextConfig = {
  // Lets a second local server build elsewhere when `.next` is locked by another one.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@rebp/contracts"],
  serverExternalPackages: ["@node-rs/argon2"],
  typedRoutes: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
  experimental: {
    optimizePackageImports: ["radix-ui"],
  },
  async headers() {
    return [
      // Document and certificate previews are framed by the portal's own viewer (FR-L-011): same-origin only.
      {
        source: "/((?!api/documents/|api/files/|api/profile/documents/).*)",
        headers: securityHeaders,
      },
      {
        source: "/api/(documents|files)/:path*",
        headers: [
          ...securityHeaders.filter(
            (h) => h.key !== "X-Frame-Options" && h.key !== "Content-Security-Policy",
          ),
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      {
        // UX-010: the applicant profile's identity documents are served the same way.
        source: "/api/profile/documents/:path*",
        headers: [
          ...securityHeaders.filter(
            (h) => h.key !== "X-Frame-Options" && h.key !== "Content-Security-Policy",
          ),
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      // The service worker must always be revalidated so updates roll out (UX-015).
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, max-age=0" }] },
    ];
  },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
