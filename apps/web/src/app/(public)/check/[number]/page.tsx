import { SearchX } from "@/components/icons";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { VerifySearch } from "@/components/register/verify-search";
import { NO_INDEX } from "@/server/seo";

export async function generateMetadata({
  params,
}: PageProps<"/check/[number]">): Promise<Metadata> {
  const { number } = await params;
  const t = await getTranslations("check");
  // Unknown numbers are never indexed; issued licences get indexable pages (FR-REG-008).
  return { title: t("resultTitle", { number: decodeURIComponent(number) }), robots: NO_INDEX };
}

/**
 * FR-REG-004: the QR target. A full-width status hero readable in under two seconds, with the
 * time of the check. Licence records are issued in Section N; until a number matches one,
 * this page states plainly that no licence was found.
 */
export default async function CheckPage({ params }: PageProps<"/check/[number]">) {
  const { number } = await params;
  const value = decodeURIComponent(number).slice(0, 40);
  const [t, format] = await Promise.all([getTranslations("check"), getFormatter()]);
  const checkedAt = format.dateTime(new Date(), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Kigali",
  });

  return (
    <div className="flex flex-1 flex-col">
      <section
        className="relative isolate overflow-hidden bg-danger-soft text-destructive"
        aria-live="polite"
      >
        <div aria-hidden className="absolute inset-0 -z-10 bg-imigongo opacity-[0.06]" />
        <div className="container-page flex flex-col items-center gap-3 py-12 text-center sm:py-16">
          <span className="inline-flex size-20 animate-pop items-center justify-center rounded-[1.6rem] bg-card shadow-[0_14px_30px_-14px_oklch(0.4_0.15_25/0.45)] dark:bg-white/[0.06]">
            <SearchX className="size-10" aria-hidden />
          </span>
          <h1 className="text-[clamp(1.75rem,1.4rem+2vw,3rem)] leading-tight font-bold tracking-[-0.03em]">
            {t("notFound")}
          </h1>
          <p className="font-mono text-lg font-semibold num text-foreground">{value}</p>
          <p className="text-xs font-medium text-muted-foreground">
            {t("checkedAt", { time: checkedAt })}
          </p>
        </div>
      </section>
      <div className="container-page flex max-w-xl animate-rise flex-col gap-4 py-12 sm:py-16">
        <p className="text-center text-sm text-muted-foreground">{t("notFoundBody")}</p>
        <VerifySearch />
      </div>
    </div>
  );
}
