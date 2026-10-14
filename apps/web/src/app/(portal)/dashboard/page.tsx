import { ArrowRight, BellRing, FileStack, ShieldCheck, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/server/auth/guards";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("nav"))("dashboard") };
}

/** FR-PORTAL-001 (shell): counts are wired up when applications and licences land (D2–D4). */
export default async function DashboardPage() {
  const { user } = await requireUser();
  const t = await getTranslations();
  const firstName = user.fullName.split(" ")[0] ?? user.fullName;
  const stats = [
    { icon: FileStack, label: t("dashboard.cards.applications") },
    { icon: Wallet, label: t("dashboard.cards.licenses") },
    { icon: BellRing, label: t("dashboard.cards.actions") },
  ];

  return (
    <>
      <PageHeader
        title={t("dashboard.greeting", { name: firstName })}
        description={t("dashboard.subtitle")}
      />

      <section className="grid gap-4 sm:grid-cols-3" aria-label={t("dashboard.subtitle")}>
        {stats.map(({ icon: Icon, label }) => (
          <Card key={label} className="gap-3">
            <Icon className="size-6 text-primary" aria-hidden />
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="font-display text-3xl font-bold">0</p>
          </Card>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-secondary/50">
          <CardHeader>
            <CardTitle>{t("dashboard.startTitle")}</CardTitle>
            <CardDescription>{t("dashboard.startBody")}</CardDescription>
          </CardHeader>
          <Button asChild className="self-start">
            <Link href="/applications">
              {t("nav.applications")} <ArrowRight />
            </Link>
          </Button>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" aria-hidden />{" "}
              {t("dashboard.securityTitle")}
            </CardTitle>
            <CardDescription>
              {user.mfaMethods.length ? t("dashboard.securityOn") : t("dashboard.securityBody")}
            </CardDescription>
          </CardHeader>
          {!user.mfaMethods.length && (
            <Button asChild variant="outline" className="self-start">
              <Link href="/settings/security#two-step">{t("dashboard.securityCta")}</Link>
            </Button>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">
              {t("dashboard.roles")}:
            </span>
            {user.roles.map((role) => (
              <Badge key={role} variant="outline">
                {t(`roles.${role}`)}
              </Badge>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
