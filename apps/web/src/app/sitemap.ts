import type { MetadataRoute } from "next";
import { languageAlternates, siteUrl } from "@/server/seo";

// Absolute URLs come from APP_URL at request time, so one build serves every environment.
export const dynamic = "force-dynamic";

/**
 * Public pages with one URL per language (ADR-010). Practitioner and firm pages are added
 * here once the register holds entries whose owners have not opted out (FR-REG-008).
 */
const PAGES: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" }[] =
  [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/register", priority: 0.9, changeFrequency: "daily" },
    { path: "/check", priority: 0.8, changeFrequency: "monthly" },
    { path: "/eligibility", priority: 0.8, changeFrequency: "monthly" },
    { path: "/categories", priority: 0.7, changeFrequency: "monthly" },
    { path: "/privacy", priority: 0.3, changeFrequency: "monthly" },
  ];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return PAGES.map(({ path, priority, changeFrequency }) => ({
    url: `${base}${path}`,
    changeFrequency,
    priority,
    alternates: { languages: languageAlternates(path) },
  }));
}
