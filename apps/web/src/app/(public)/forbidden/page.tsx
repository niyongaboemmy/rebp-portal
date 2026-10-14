import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default async function ForbiddenPage() {
  const t = await getTranslations("forbidden");
  return (
    <div className="container-page py-14">
      <EmptyState
        icon={ShieldAlert}
        title={t("title")}
        description={t("body")}
        action={
          <Button asChild>
            <Link href="/dashboard">{t("cta")}</Link>
          </Button>
        }
      />
    </div>
  );
}
