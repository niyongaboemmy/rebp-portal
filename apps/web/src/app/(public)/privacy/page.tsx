import { Eye, FileDown, Globe2, Lock, ScanSearch } from "@/components/icons";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
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
    <article className="container-page flex max-w-3xl flex-col gap-8 py-10 sm:py-14">
      <header className="flex flex-col gap-3">
        <h1>{t("title")}</h1>
        <Alert variant="warning">{t("draft")}</Alert>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2" aria-label={t("highlightsLabel")}>
        {HIGHLIGHTS.map(({ key, icon: Icon }, index) => (
          <Reveal key={key} stagger={index}>
            <li className="flex items-center gap-4 rounded-2xl border bg-card p-4 raised last:sm:col-span-2">
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
                <Icon className="size-6" aria-hidden />
              </span>
              <span className="text-sm font-semibold sm:text-base">{t(`highlights.${key}`)}</span>
            </li>
          </Reveal>
        ))}
      </ul>
      <section aria-labelledby="notice-title" className="flex flex-col gap-3">
        <h2 id="notice-title" className="text-lg">
          {t("fullNotice")}
        </h2>
        <p className="leading-relaxed text-muted-foreground">{t("body")}</p>
      </section>
    </article>
  );
}
