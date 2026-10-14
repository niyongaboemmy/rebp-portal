import { Languages, Lock, QrCode, ShieldCheck, Timer } from "@/components/icons";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OrbitArt } from "@/components/motion/orbit-art";
import { PageHero } from "@/components/layout/page-hero";
import { VerifySearch } from "@/components/register/verify-search";
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

/** FR-REG-004 entry point: type a licence number or scan the certificate's QR code. */
export default async function CheckIndexPage() {
  const t = await getTranslations("check");
  const tl = await getTranslations("landing");
  return (
    <div className="flex flex-1 flex-col">
      <PageHero
        align="center"
        icon={<ShieldCheck />}
        eyebrow={tl("eyebrow")}
        title={t("title")}
        description={t("subtitle")}
        className="flex-1"
      >
        <VerifySearch className="w-full max-w-xl" />
        <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          {FACTS.map(({ key, icon: Icon }) => (
            <li key={key} className="inline-flex items-center gap-1.5">
              <Icon className="size-4 text-link" aria-hidden />
              {tl(`trustItems.${key}.title`)}
            </li>
          ))}
        </ul>
        <OrbitArt
          className="mt-4 max-w-[18rem] opacity-80 sm:max-w-xs"
          center={<QrCode className="size-14 text-link" />}
        />
      </PageHero>
    </div>
  );
}
