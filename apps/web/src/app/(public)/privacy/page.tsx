import { Eye, FileDown, Globe2, Lock, ScanSearch } from "@/components/icons";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHero } from "@/components/layout/page-hero";
import { Reveal } from "@/components/motion/reveal";
import { Alert } from "@/components/ui/alert";
import { publicPageMetadata } from "@/server/seo";

const HIGHLIGHTS = [
  { key: "minimal", icon: ScanSearch },
  { key: "encrypted", icon: Lock },
  { key: "access", icon: Eye },
  { key: "published", icon: Globe2 },
  { key: "rights", icon: FileDown },
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privacy");
  return publicPageMetadata({
    path: "/privacy",
    title: t("title"),
    description: t("metaDescription"),
  });
}

/**
 * PRV-002 privacy notice (placeholder text pending legal approval, P4). The five commitments
 * are shown first as icons (Law 058/2021: clear, accessible information); the notice follows.
 */
export default async function PrivacyPage() {
  const t = await getTranslations("privacy");
  return (
    <article className="flex flex-col">
      <PageHero eyebrow={t("highlightsLabel")} title={t("title")}>
        <Alert variant="warning" className="max-w-2xl">
          {t("draft")}
        </Alert>
      </PageHero>
      <div className="container-page flex flex-col gap-12 pb-20 sm:pb-28 [&>*]:max-w-4xl">
        <ul className="grid gap-3 sm:grid-cols-2" aria-label={t("highlightsLabel")}>
          {HIGHLIGHTS.map(({ key, icon: Icon }, index) => (
            <Reveal key={key} stagger={index}>
              <li className="group flex items-center gap-4 rounded-2xl bg-surface-2 p-4 transition-colors hover:bg-primary-soft/40 sm:p-5 last:sm:col-span-2 dark:bg-white/[0.03] dark:hover:bg-primary/[0.08]">
                <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(140deg,var(--primary),color-mix(in_oklch,var(--primary)_65%,var(--sky)))] text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.3)] transition-transform duration-(--dur-3) ease-spring group-hover:scale-105 group-hover:-rotate-3">
                  <Icon filled className="size-6" aria-hidden />
                </span>
                <span className="text-sm font-semibold sm:text-base">{t(`highlights.${key}`)}</span>
              </li>
            </Reveal>
          ))}
        </ul>
        <section aria-labelledby="notice-title" className="flex flex-col gap-3">
          <h2 id="notice-title" className="text-xl">
            {t("fullNotice")}
          </h2>
          <p className="leading-relaxed text-muted-foreground">{t("body")}</p>
        </section>
      </div>
    </article>
  );
}
