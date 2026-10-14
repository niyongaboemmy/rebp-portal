import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/ui/logo";

export async function SiteFooter() {
  const t = await getTranslations();
  return (
    <footer className="mt-auto border-t bg-card">
      <div className="container-page flex flex-col gap-6 py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <Logo />
          <p className="max-w-sm text-sm text-muted-foreground">{t("brand.body")}</p>
        </div>
        <nav
          className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground"
          aria-label="Footer"
        >
          <Link href="/privacy" className="hover:text-foreground">
            {t("footer.privacy")}
          </Link>
          <Link href="/register" className="hover:text-foreground">
            {t("nav.register")}
          </Link>
          <Link href="/categories" className="hover:text-foreground">
            {t("nav.categories")}
          </Link>
        </nav>
      </div>
      <div className="border-t">
        <p className="container-page py-4 text-xs text-muted-foreground">
          {t("footer.rights", { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
