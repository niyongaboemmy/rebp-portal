import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { redirectIfSignedIn } from "@/server/auth/guards";
import { isGoogleEnabled } from "@/server/env";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("nav"))("signUp") };
}

export default async function SignUpPage() {
  await redirectIfSignedIn();
  const t = await getTranslations("auth.signUp");
  return (
    <AuthCard
      title={t("title")}
      description={t("subtitle")}
      footer={
        <>
          {t("haveAccount")}{" "}
          <Link href="/sign-in" className="hit-area font-semibold text-primary hover:underline">
            {t("signIn")}
          </Link>
        </>
      }
    >
      <GoogleButton enabled={isGoogleEnabled()} />
      <OrDivider />
      <SignUpForm />
    </AuthCard>
  );
}
