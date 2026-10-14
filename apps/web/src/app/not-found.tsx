import { Compass } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <main id="main" className="container-page flex min-h-dvh items-center justify-center py-14">
      <EmptyState
        icon={Compass}
        title={t("title")}
        description={t("body")}
        className="w-full max-w-lg"
        action={
          <Button asChild>
            <Link href="/">{t("cta")}</Link>
          </Button>
        }
      />
    </main>
  );
}
