import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { TwoStepForm } from "@/components/auth/two-step-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { COOKIE, readCookie } from "@/server/auth/cookies";
import { safeNextPath } from "@/server/auth/guards";
import { describeChallenge } from "@/server/auth/login";
import { maskDestination } from "@/lib/utils";
import { devCodeFor } from "@/server/notifications";

export default async function TwoStepPage({ searchParams }: PageProps<"/sign-in/two-step">) {
  const t = await getTranslations("auth.twoStep");
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNextPath(params.next) : undefined;
  const token = await readCookie(COOKIE.challenge());
  const challenge = token ? await describeChallenge(token).catch(() => null) : null;

  if (!challenge) {
    return (
      <AuthCard title={t("title")} icon={<ShieldCheck />}>
        <Alert variant="warning">{t("expired")}</Alert>
        <Button asChild size="lg">
          <Link href="/sign-in">{t("backToSignIn")}</Link>
        </Button>
      </AuthCard>
    );
  }

  const devCode =
    challenge.method === "TOTP" ? null : await devCodeFor(challenge.destination, "mfaLoginCode");

  return (
    <AuthCard title={t("title")} icon={<ShieldCheck />}>
      <TwoStepForm
        method={challenge.method}
        methods={challenge.methods}
        destination={maskDestination(challenge.method, challenge.destination)}
        devCode={devCode}
        next={next}
      />
    </AuthCard>
  );
}
