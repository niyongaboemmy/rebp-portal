import { ArrowRight, QrCode, Wallet } from "@/components/icons";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/layout/coming-soon";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/server/auth/guards";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("placeholders"))("licensesTitle") };
}

/** Screen 6 (licence wallet). The card outline shows what will live here once a licence is issued. */
export default async function LicensesPage() {
  await requireUser();
  const t = await getTranslations();
  return (
    <ComingSoon
      icon={Wallet}
      title={t("placeholders.licensesTitle")}
      description={t("placeholders.licensesBody")}
      art={
        <div
          aria-hidden
          className="relative flex aspect-[1.586] w-full max-w-xs animate-pop flex-col justify-between rounded-[1.5rem] bg-primary-soft/40 p-4"
        >
          <div className="flex justify-between">
            <span className="h-3 w-24 rounded-full bg-primary/20" />
            <span className="h-5 w-14 rounded-full bg-primary/20" />
          </div>
          <div className="flex items-end justify-between">
            <div className="flex flex-col gap-2">
              <span className="h-3.5 w-28 rounded-full bg-primary/25" />
              <span className="h-2.5 w-20 rounded-full bg-primary/15" />
            </div>
            <span className="inline-flex size-14 items-center justify-center rounded-xl bg-card text-link">
              <QrCode className="size-8" />
            </span>
          </div>
        </div>
      }
      action={
        <Button asChild variant="outline">
          <Link href="/check">
            {t("nav.verify")} <ArrowRight />
          </Link>
        </Button>
      }
    />
  );
}
