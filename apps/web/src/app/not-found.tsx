import { BookUser, Home } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorArt } from "@/components/ui/error-art";

export default async function NotFound() {
  const t = await getTranslations();
  return (
    <main id="main" className="container-page flex min-h-dvh items-center justify-center py-14">
      <EmptyState
        icon={Home}
        art={<ErrorArt code="404" />}
        headingLevel={1}
        title={t("notFound.title")}
        description={t("notFound.body")}
        className="w-full max-w-lg"
        action={
          <div className="flex flex-col gap-2 xs:flex-row">
            <Button asChild>
              <Link href="/">
                <Home /> {t("notFound.cta")}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/register">
                <BookUser /> {t("nav.register")}
              </Link>
            </Button>
          </div>
        }
      />
    </main>
  );
}
