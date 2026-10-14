import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";
import { AuthCard } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/sign-in-form";
import { Alert } from "@/components/ui/alert";
import { redirectIfSignedIn, safeNextPath } from "@/server/auth/guards";
import { isGoogleEnabled } from "@/server/env";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("nav"))("signIn") };
}

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  await redirectIfSignedIn();
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNextPath(params.next) : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;
  const reset = params.reset === "1";
  const t = await getTranslations("auth");

  return (
    <AuthCard
      title={t("signIn.title")}
      description={t("signIn.subtitle")}
      footer={
        <>
          {t("signIn.noAccount")}{" "}
          <Link href="/sign-up" className="hit-area font-semibold text-primary hover:underline">
            {t("signIn.createAccount")}
          </Link>
        </>
      }
    >
      {reset && <Alert variant="success">{t("reset.success")}</Alert>}
      {error && (
        <Alert variant="danger">
          {t.has(`oauthErrors.${error}`)
            ? t(`oauthErrors.${error}` as "oauthErrors.oauthFailed")
            : t("oauthErrors.oauthFailed")}
        </Alert>
      )}
      <GoogleButton enabled={isGoogleEnabled()} next={next} />
      <OrDivider />
      <SignInForm next={next} />
    </AuthCard>
  );
}
