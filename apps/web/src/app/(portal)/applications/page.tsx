import { ArrowRight, FileStack } from "@/components/icons";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { JOURNEY_STAGES } from "@rebp/contracts";
import { ComingSoon } from "@/components/layout/coming-soon";
import { StateJourney } from "@/components/data/state-journey";
import { Button } from "@/components/ui/button";
import { requireCapability } from "@/server/auth/guards";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("placeholders"))("applicationsTitle") };
}

/** FR-PORTAL-001: applications list. Until the wizard ships, show the journey and the pre-check. */
export default async function ApplicationsPage() {
  await requireCapability("application.edit");
  const t = await getTranslations();
  return (
    <ComingSoon
      icon={FileStack}
      title={t("placeholders.applicationsTitle")}
      description={t("placeholders.applicationsBody")}
      art={
        <div className="flex w-full max-w-xs flex-col gap-3 rounded-2xl border bg-card p-4 text-left raised">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
              <FileStack className="size-5" aria-hidden />
            </span>
            <div className="flex flex-1 flex-col gap-1.5" aria-hidden>
              <span className="h-2.5 w-3/4 rounded-full bg-muted" />
              <span className="h-2 w-1/2 rounded-full bg-muted" />
            </div>
          </div>
          <StateJourney
            stages={JOURNEY_STAGES}
            current={0}
            label={t("journey.label", { stage: t("journey.stages.draft") })}
          />
        </div>
      }
      action={
        <Button asChild>
          <Link href="/eligibility">
            {t("nav.eligibility")} <ArrowRight />
          </Link>
        </Button>
      }
    />
  );
}
