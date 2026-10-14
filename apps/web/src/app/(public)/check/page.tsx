import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
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

/** FR-REG-004 entry point: type a licence number or scan the certificate's QR code. */
export default async function CheckIndexPage() {
  const t = await getTranslations("check");
  return (
    <div className="relative isolate flex flex-1">
      <div aria-hidden className="absolute inset-0 -z-10 bg-ambient" />
      <div className="container-page flex max-w-xl flex-col items-center gap-6 py-14 text-center sm:py-20">
        <span className="inline-flex size-20 animate-pop items-center justify-center rounded-[1.75rem] bg-primary-soft text-primary">
          <ShieldCheck className="size-10" aria-hidden />
        </span>
        <h1>{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
        <VerifySearch className="w-full" />
      </div>
    </div>
  );
}
