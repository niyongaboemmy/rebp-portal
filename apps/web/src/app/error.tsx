"use client";

import { AlertTriangle } from "@/components/icons";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errorPage");
  return (
    <div className="container-page flex flex-1 items-center justify-center py-14">
      <EmptyState
        icon={AlertTriangle}
        title={t("title")}
        description={t("body")}
        className="w-full max-w-lg"
        action={<Button onClick={reset}>{t("retry")}</Button>}
      />
    </div>
  );
}
