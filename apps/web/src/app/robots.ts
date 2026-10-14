import type { MetadataRoute } from "next";
import { siteUrl } from "@/server/seo";

// Absolute URLs come from APP_URL at request time, so one build serves every environment.
export const dynamic = "force-dynamic";

/** Public pages are crawlable; account, staff, auth and API routes are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/register", "/check", "/categories", "/eligibility", "/privacy"],
      disallow: [
        "/dashboard",
        "/applications",
        "/licenses",
        "/confirmations",
        "/firm",
        "/settings",
        "/backoffice",
        "/sign-in",
        "/sign-up",
        "/verify",
        "/forgot-password",
        "/reset-password",
        "/api/",
        "/dev/",
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
