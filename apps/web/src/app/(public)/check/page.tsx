import {
  ArrowRight,
  BookUser,
  Building2,
  Languages,
  Lock,
  MapPin,
  QrCode,
  ScanLine,
  ShieldCheck,
  Timer,
} from "@/components/icons";
import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LICENSE_STATUS_TONES, type LicenseStatus } from "@rebp/contracts";
import { LicenceStatusBadge } from "@/components/applications/status-badges";
import { DistrictMapTeaser } from "@/components/check/district-map-teaser";
import { VerifyPreviewProvider } from "@/components/check/verify-preview-provider";
import { TONE_ICONS, TONE_SOFT_BG, TONE_TEXT } from "@/components/data/tones";
import { SketchUnderline } from "@/components/motion/sketch-underline";
import { VerifySearch } from "@/components/register/verify-search";
import { cn } from "@/lib/utils";
import { listDistricts, recentLicences } from "@/server/licensing/public-queries";
import { registerByDistrict } from "@/server/licensing/register-map";
import { publicPageMetadata } from "@/server/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("check");
  return publicPageMetadata({
    path: "/check",
    title: t("title"),
    description: t("metaDescription"),
  });
}

const FACTS = [
  { key: "secure", icon: Lock },
  { key: "live", icon: Timer },
  { key: "languages", icon: Languages },
] as const;

const STEPS = [
  { key: "find", icon: ScanLine },
  { key: "read", icon: ShieldCheck },
  { key: "locate", icon: MapPin },
] as const;

/** What a client should do for each verdict, in the order people meet them. */
const LEGEND: LicenseStatus[] = ["ACTIVE", "SUSPENDED", "EXPIRED", "REVOKED"];

/**
 * FR-REG-004 entry point: type a licence number (straight to its verdict), a name (live
 * suggestions, then the register list) or scan the certificate's QR code. Beside it, the
 * register map by district (FR-REG-002) so clients can also find who is licensed near them;
 * below, what each verdict means and what to do.
 */
export default async function CheckIndexPage() {
  const t = await getTranslations();
  const [recent, groups, districts] = await Promise.all([
    recentLicences(3),
    registerByDistrict({}),
    listDistricts(),
  ]);
  const byCode = new Map(districts.map((d) => [d.code, d]));
  const teaser = groups.map((g) => ({
    code: g.code,
    name: byCode.get(g.code)?.name ?? g.code,
    province: byCode.get(g.code)?.province ?? "",
    total: g.total,
    valid: g.valid,
  }));

  return (
    <VerifyPreviewProvider>
      <div className="flex flex-1 flex-col">
        {/* Hero: the task first (search), the map beside it. */}
        <section className="relative isolate">
          <div aria-hidden className="absolute inset-0 -z-10 bg-ambient" />
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 -z-10 h-80 bg-imigongo-fade text-link opacity-[0.05]"
          />
          <div className="container-page grid items-start gap-10 pt-8 pb-12 sm:pt-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14 lg:pb-16">
            <div className="flex min-w-0 flex-col gap-5 lg:pt-10">
              <span className="inline-flex w-fit animate-rise items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary-soft-foreground">
                <span className="relative flex size-1.5" aria-hidden>
                  <span className="absolute inset-0 animate-ping rounded-full bg-ember/70" />
                  <span className="relative size-1.5 rounded-full bg-ember" />
                </span>
                {t("landing.eyebrow")}
              </span>
              <div className="flex flex-col gap-2">
                <h1
                  className="animate-rise text-[clamp(2.1rem,1.4rem+2.6vw,3.5rem)] leading-[1.05] font-bold tracking-[-0.025em] text-balance"
                  style={{ animationDelay: "60ms" }}
                >
                  {t("check.title")}
                </h1>
                <SketchUnderline className="h-2.5 w-36 sm:h-3 sm:w-44" />
              </div>
              <p
                className="max-w-xl animate-rise text-base text-muted-foreground sm:text-lg"
                style={{ animationDelay: "120ms" }}
              >
                {t("check.subtitle")}
              </p>

              {/* The task. */}
              <div
                className="relative z-30 flex animate-rise flex-col gap-2.5"
                style={{ animationDelay: "180ms" }}
              >
                <VerifySearch
                  mode="verify"
                  tone="solid"
                  examples={(["number", "name", "firm"] as const).map((k) =>
                    t(`check.examples.${k}`),
                  )}
                  examplesLabel={t("check.tryTyping")}
                  hiddenFields={{ view: "list" }}
                  className="w-full max-w-xl"
                />
                <p className="flex items-start gap-2 px-4 text-xs text-muted-foreground">
                  <QrCode className="mt-px size-3.5 shrink-0 text-link" aria-hidden />
                  <span>{t("check.hint")}</span>
                </p>
              </div>

              {/* Try it: recent valid licences (public). */}
              {recent.length > 0 && (
                <div
                  className="flex animate-rise flex-wrap items-center gap-2"
                  style={{ animationDelay: "240ms" }}
                >
                  <span className="text-xs font-semibold text-muted-foreground">
                    {t("check.try")}
                  </span>
                  {recent.map((r) => (
                    <Link
                      key={r.licenceNo}
                      href={`/check/${encodeURIComponent(r.licenceNo)}` as Route}
                      title={r.displayName}
                      className="group inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground/[0.05] px-3 font-mono text-xs font-semibold transition-colors hover:bg-primary hover:text-primary-foreground dark:bg-white/[0.06]"
                    >
                      {r.kind === "FIRM" ? (
                        <Building2 className="size-3.5 text-link group-hover:text-primary-foreground" />
                      ) : (
                        <BookUser className="size-3.5 text-link group-hover:text-primary-foreground" />
                      )}
                      {r.licenceNo}
                    </Link>
                  ))}
                </div>
              )}

              <ul
                className="flex animate-rise flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground"
                style={{ animationDelay: "300ms" }}
              >
                {FACTS.map(({ key, icon: Icon }) => (
                  <li key={key} className="inline-flex items-center gap-1.5">
                    <Icon className="size-4 text-link" aria-hidden />
                    {t(`landing.trustItems.${key}.title`)}
                  </li>
                ))}
              </ul>
            </div>

            <div className="animate-rise" style={{ animationDelay: "200ms" }}>
              <DistrictMapTeaser districts={teaser} />
            </div>
          </div>
        </section>

        {/* How it works: three steps, numbered and linked. */}
        <section aria-labelledby="steps-title" className="container-page py-12 sm:py-16">
          <h2 id="steps-title" className="text-2xl font-bold tracking-[-0.02em] sm:text-3xl">
            {t("check.steps.title")}
          </h2>
          <ol className="mt-6 grid gap-3 md:grid-cols-3">
            {STEPS.map(({ key, icon: Icon }, i) => (
              <li
                key={key}
                className="group relative flex flex-col gap-3 rounded-3xl bg-card p-5 shadow-[0_1px_2px_oklch(0.3_0.08_264/0.05)] transition-[transform,box-shadow] duration-(--dur-3) ease-spring hover:-translate-y-1 hover:shadow-[0_20px_44px_-24px_oklch(0.35_0.15_264/0.45)] dark:bg-white/[0.04] dark:shadow-none"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-[linear-gradient(140deg,var(--primary),color-mix(in_oklch,var(--primary)_65%,var(--sky)))] text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.3)] transition-transform duration-(--dur-3) ease-spring group-hover:-rotate-6">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="font-mono text-xs font-bold text-muted-foreground">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="text-base font-semibold">{t(`check.steps.${key}.title`)}</h3>
                <p className="text-sm text-muted-foreground">{t(`check.steps.${key}.body`)}</p>
                {key === "locate" && (
                  <Link
                    href={"/register" as Route}
                    className="group/l mt-auto inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-link"
                  >
                    {t("check.map.cta")}
                    <ArrowRight
                      className="size-4 transition-transform group-hover/l:translate-x-1"
                      aria-hidden
                    />
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </section>

        {/* Reading the result. */}
        <section aria-labelledby="legend-title" className="relative isolate pb-16 sm:pb-20">
          <div className="container-page flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h2 id="legend-title" className="text-2xl font-bold tracking-[-0.02em] sm:text-3xl">
                {t("check.legend.title")}
              </h2>
              <p className="text-muted-foreground">{t("check.legend.body")}</p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {LEGEND.map((status) => {
                const tone = LICENSE_STATUS_TONES[status];
                const Icon = TONE_ICONS[tone];
                return (
                  <li
                    key={status}
                    className="flex flex-col gap-3 rounded-3xl bg-card p-5 shadow-[0_1px_2px_oklch(0.3_0.08_264/0.05)] dark:bg-white/[0.04] dark:shadow-none"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={cn(
                          "inline-flex size-10 items-center justify-center rounded-2xl",
                          TONE_SOFT_BG[tone],
                          TONE_TEXT[tone],
                        )}
                      >
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <LicenceStatusBadge status={status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t(`verification.verdictBody.${status}`)}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </div>
    </VerifyPreviewProvider>
  );
}
