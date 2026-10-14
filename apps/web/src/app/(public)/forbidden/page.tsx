import { KeyRound, LayoutDashboard, ShieldAlert } from "@/components/icons";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorArt } from "@/components/ui/error-art";

export default async function ForbiddenPage() {
  const t = await getTranslations();
  return (
    <div className="container-page py-14">
      <EmptyState
        icon={ShieldAlert}
        art={<ErrorArt code="403" />}
        headingLevel={1}
        title={t("forbidden.title")}
        description={t("forbidden.body")}
        action={
          <div className="flex flex-col gap-2 xs:flex-row">
            <Button asChild>
              <Link href="/dashboard">
                <LayoutDashboard /> {t("forbidden.cta")}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/settings/access">
                <KeyRound /> {t("nav.myAccess")}
              </Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}
