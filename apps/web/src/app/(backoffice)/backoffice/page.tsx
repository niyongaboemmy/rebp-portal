import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { can } from "@rebp/contracts";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { BACKOFFICE_SECTIONS } from "@/config/navigation";
import { requireCapability } from "@/server/auth/guards";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("nav"))("backoffice") };
}

export default async function BackofficeOverview() {
  const { user } = await requireCapability("backoffice.access");
  const t = await getTranslations();
  const sections = Object.entries(BACKOFFICE_SECTIONS).filter(([, s]) =>
    can(user.roles, s.capability),
  );

  return (
    <>
      <PageHeader
        title={t("nav.backoffice")}
        description={user.roles.map((r) => t(`roles.${r}`)).join(" · ")}
      />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map(([slug, s]) => {
          const Icon = s.icon;
          return (
            <li key={slug}>
              <Link href={`/backoffice/${slug}`} className="block h-full">
                <Card className="h-full gap-3 transition-colors hover:border-primary/40">
                  <Icon className="size-6 text-primary" aria-hidden />
                  <p className="font-display text-lg font-semibold">{t(`nav.${s.label}`)}</p>
                  <Badge variant="accent">
                    {t("placeholders.plannedFor", { milestone: s.milestone })}
                  </Badge>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
